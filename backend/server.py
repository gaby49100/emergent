# QBitMaster - Backend FastAPI avec Administration
# Gestion de torrents multi-utilisateurs avec qBittorrent et Jackett

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import jwt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'qbitmaster-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="QBitMaster API", description="API de gestion de torrents multi-utilisateurs")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth", tags=["Authentification"])
torrent_router = APIRouter(prefix="/torrents", tags=["Torrents"])
jackett_router = APIRouter(prefix="/jackett", tags=["Jackett"])
notification_router = APIRouter(prefix="/notifications", tags=["Notifications"])
admin_router = APIRouter(prefix="/admin", tags=["Administration"])

security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

# User Models
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str = "user"
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    created_at: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    group_id: Optional[str] = None
    is_active: Optional[bool] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Group Models
class GroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    max_torrents: int = Field(default=100, ge=1)
    max_download_speed: int = Field(default=0, ge=0)  # 0 = unlimited
    max_upload_speed: int = Field(default=0, ge=0)  # 0 = unlimited
    can_use_jackett: bool = True
    can_see_all_torrents: bool = True

class GroupResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    max_torrents: int
    max_download_speed: int
    max_upload_speed: int
    can_use_jackett: bool
    can_see_all_torrents: bool
    user_count: int = 0
    created_at: str

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    max_torrents: Optional[int] = None
    max_download_speed: Optional[int] = None
    max_upload_speed: Optional[int] = None
    can_use_jackett: Optional[bool] = None
    can_see_all_torrents: Optional[bool] = None

# Settings Models
class QBitSettings(BaseModel):
    host: str = Field(..., min_length=1)
    port: int = Field(default=8080, ge=1, le=65535)
    username: str
    password: str
    use_https: bool = False

class JackettSettings(BaseModel):
    url: str = Field(..., min_length=1)
    api_key: str = Field(..., min_length=1)

class SettingsResponse(BaseModel):
    qbittorrent: Optional[dict] = None
    jackett: Optional[dict] = None
    qbittorrent_status: str = "not_configured"
    jackett_status: str = "not_configured"

# Torrent Models
class TorrentCreate(BaseModel):
    name: str
    magnet: str

class TorrentResponse(BaseModel):
    id: str
    user_id: str
    username: str
    name: str
    magnet: str
    status: str
    progress: float
    download_speed: float
    upload_speed: float
    size: int
    downloaded: int
    eta: int
    hash: str
    created_at: str

class TorrentStats(BaseModel):
    total_torrents: int
    active_torrents: int
    completed_torrents: int
    total_download_speed: float
    total_upload_speed: float

# Jackett Models
class JackettSearchResult(BaseModel):
    title: str
    size: int
    seeders: int
    leechers: int
    magnet: str
    tracker: str
    published: str

class JackettSearchResponse(BaseModel):
    results: List[JackettSearchResult]
    total: int

# Notification Models
class NotificationResponse(BaseModel):
    id: str
    user_id: str
    torrent_id: str
    torrent_name: str
    message: str
    read: bool
    created_at: str

# ==================== HELPERS ====================

def hash_password(password: str) -> str:
    """Hash un mot de passe avec SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Vérifie un mot de passe hashé"""
    return hash_password(password) == hashed

def create_token(user_id: str, username: str, role: str) -> str:
    """Crée un token JWT"""
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Récupère l'utilisateur actuel depuis le token JWT"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token invalide")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
        
        # Get group info if user has a group
        if user.get("group_id"):
            group = await db.groups.find_one({"id": user["group_id"]}, {"_id": 0})
            if group:
                user["group_name"] = group.get("name")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Vérifie que l'utilisateur est admin"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return current_user

async def get_settings():
    """Récupère les paramètres depuis la base de données"""
    settings = await db.settings.find_one({"type": "app_settings"}, {"_id": 0})
    return settings or {}

async def get_qbit_config():
    """Récupère la configuration qBittorrent"""
    settings = await get_settings()
    qbit = settings.get("qbittorrent")
    if qbit:
        protocol = "https" if qbit.get("use_https") else "http"
        return {
            "host": f"{protocol}://{qbit['host']}:{qbit['port']}",
            "username": qbit["username"],
            "password": qbit["password"]
        }
    return None

async def get_jackett_config():
    """Récupère la configuration Jackett"""
    settings = await get_settings()
    jackett = settings.get("jackett")
    if jackett:
        return {
            "url": jackett["url"],
            "api_key": jackett["api_key"]
        }
    return None

# qBittorrent session management
qbit_session_cookie = None

async def qbit_login():
    """Connexion à qBittorrent et récupération du cookie de session"""
    global qbit_session_cookie
    
    config = await get_qbit_config()
    if not config:
        logger.warning("qBittorrent non configuré")
        return False
    
    try:
        async with httpx.AsyncClient(follow_redirects=True, verify=True) as client:
            logger.info(f"Tentative connexion qBittorrent: {config['host']}")
            response = await client.post(
                f"{config['host']}/api/v2/auth/login",
                data={"username": config['username'], "password": config['password']}
            )
            logger.info(f"qBittorrent login response: {response.status_code} - {response.text}")
            if response.status_code == 200 and response.text == "Ok.":
                qbit_session_cookie = response.cookies.get("SID")
                logger.info("Connexion qBittorrent réussie")
                return True
            else:
                logger.error(f"Échec connexion qBittorrent: Code {response.status_code}, Réponse: {response.text}")
                return False
    except Exception as e:
        logger.error(f"Erreur connexion qBittorrent: {e}")
        return False

async def qbit_request(method: str, endpoint: str, **kwargs):
    """Effectue une requête à l'API qBittorrent"""
    global qbit_session_cookie
    
    config = await get_qbit_config()
    if not config:
        raise HTTPException(status_code=503, detail="qBittorrent non configuré. Configurez-le dans Administration > Paramètres.")
    
    if not qbit_session_cookie:
        await qbit_login()
    
    try:
        async with httpx.AsyncClient() as client:
            cookies = {"SID": qbit_session_cookie} if qbit_session_cookie else {}
            
            if method.upper() == "GET":
                response = await client.get(f"{config['host']}{endpoint}", cookies=cookies, **kwargs)
            else:
                response = await client.post(f"{config['host']}{endpoint}", cookies=cookies, **kwargs)
            
            # Si non autorisé, reconnexion et retry
            if response.status_code == 403:
                await qbit_login()
                cookies = {"SID": qbit_session_cookie} if qbit_session_cookie else {}
                if method.upper() == "GET":
                    response = await client.get(f"{config['host']}{endpoint}", cookies=cookies, **kwargs)
                else:
                    response = await client.post(f"{config['host']}{endpoint}", cookies=cookies, **kwargs)
            
            return response
    except Exception as e:
        logger.error(f"Erreur requête qBittorrent: {e}")
        raise HTTPException(status_code=503, detail=f"Service qBittorrent indisponible: {str(e)}")

# ==================== AUTH ROUTES ====================

@auth_router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """Inscription d'un nouvel utilisateur"""
    # Vérifier si l'email existe déjà
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # Vérifier si le username existe déjà
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est déjà pris")
    
    # Vérifier si c'est le premier utilisateur (sera admin)
    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 else "user"
    
    # Trouver le groupe par défaut
    default_group = await db.groups.find_one({"name": "Défaut"})
    group_id = default_group["id"] if default_group else None
    
    # Créer l'utilisateur
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "role": role,
        "group_id": group_id,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    
    # Créer le token
    token = create_token(user_id, user_data.username, role)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            username=user_data.username,
            email=user_data.email,
            role=role,
            group_id=group_id,
            created_at=user["created_at"]
        )
    )

@auth_router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Connexion d'un utilisateur"""
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Compte désactivé. Contactez un administrateur.")
    
    # Get group name
    group_name = None
    if user.get("group_id"):
        group = await db.groups.find_one({"id": user["group_id"]}, {"_id": 0})
        if group:
            group_name = group.get("name")
    
    token = create_token(user["id"], user["username"], user.get("role", "user"))
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            email=user["email"],
            role=user.get("role", "user"),
            group_id=user.get("group_id"),
            group_name=group_name,
            created_at=user["created_at"]
        )
    )

@auth_router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Récupère les informations de l'utilisateur connecté"""
    return UserResponse(**current_user)

# ==================== ADMIN ROUTES ====================

# Settings management
@admin_router.get("/settings", response_model=SettingsResponse)
async def get_admin_settings(admin: dict = Depends(get_admin_user)):
    """Récupère les paramètres de l'application"""
    settings = await get_settings()
    
    qbit_config = settings.get("qbittorrent")
    jackett_config = settings.get("jackett")
    
    response = SettingsResponse(
        qbittorrent={
            "host": qbit_config.get("host", "") if qbit_config else "",
            "port": qbit_config.get("port", 8080) if qbit_config else 8080,
            "username": qbit_config.get("username", "") if qbit_config else "",
            "use_https": qbit_config.get("use_https", False) if qbit_config else False
        } if qbit_config else None,
        jackett={
            "url": jackett_config.get("url", "") if jackett_config else ""
        } if jackett_config else None,
        qbittorrent_status="configured" if qbit_config else "not_configured",
        jackett_status="configured" if jackett_config else "not_configured"
    )
    
    return response

@admin_router.post("/settings/qbittorrent")
async def save_qbit_settings(settings: QBitSettings, admin: dict = Depends(get_admin_user)):
    """Sauvegarde les paramètres qBittorrent"""
    global qbit_session_cookie
    
    # Nettoyer le host (enlever protocole et port si inclus par erreur)
    clean_host = settings.host.strip()
    if clean_host.startswith("https://"):
        clean_host = clean_host.replace("https://", "")
    if clean_host.startswith("http://"):
        clean_host = clean_host.replace("http://", "")
    clean_host = clean_host.rstrip("/")
    if ":" in clean_host:
        clean_host = clean_host.split(":")[0]
    
    await db.settings.update_one(
        {"type": "app_settings"},
        {"$set": {
            "qbittorrent": {
                "host": clean_host,
                "port": settings.port,
                "username": settings.username,
                "password": settings.password,
                "use_https": settings.use_https
            }
        }},
        upsert=True
    )
    
    # Reset session cookie to force reconnection
    qbit_session_cookie = None
    
    # Test connection
    try:
        success = await qbit_login()
        if success:
            return {"message": "Paramètres qBittorrent sauvegardés et connexion réussie", "status": "connected"}
        else:
            return {"message": "Paramètres sauvegardés mais échec de connexion", "status": "error"}
    except Exception as e:
        return {"message": f"Paramètres sauvegardés mais erreur: {str(e)}", "status": "error"}

@admin_router.post("/settings/jackett")
async def save_jackett_settings(settings: JackettSettings, admin: dict = Depends(get_admin_user)):
    """Sauvegarde les paramètres Jackett"""
    await db.settings.update_one(
        {"type": "app_settings"},
        {"$set": {
            "jackett": {
                "url": settings.url,
                "api_key": settings.api_key
            }
        }},
        upsert=True
    )
    
    # Test connection
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.url}/api/v2.0/server/config",
                params={"apikey": settings.api_key}
            )
            if response.status_code == 200:
                return {"message": "Paramètres Jackett sauvegardés et connexion réussie", "status": "connected"}
            else:
                return {"message": "Paramètres sauvegardés mais échec de connexion", "status": "error"}
    except Exception as e:
        return {"message": f"Paramètres sauvegardés mais erreur: {str(e)}", "status": "error"}

@admin_router.post("/settings/test-qbittorrent")
async def test_qbit_connection(admin: dict = Depends(get_admin_user)):
    """Teste la connexion à qBittorrent"""
    config = await get_qbit_config()
    if not config:
        return {"status": "error", "message": "qBittorrent non configuré"}
    
    try:
        # Test login first
        async with httpx.AsyncClient(follow_redirects=True, verify=True, timeout=10.0) as client:
            login_response = await client.post(
                f"{config['host']}/api/v2/auth/login",
                data={"username": config['username'], "password": config['password']}
            )
            
            if login_response.status_code != 200 or login_response.text != "Ok.":
                return {
                    "status": "error", 
                    "message": f"Échec authentification: {login_response.text}. Vérifiez le nom d'utilisateur et mot de passe."
                }
            
            # Get version
            sid = login_response.cookies.get("SID")
            version_response = await client.get(
                f"{config['host']}/api/v2/app/version",
                cookies={"SID": sid} if sid else {}
            )
            
            if version_response.status_code == 200:
                return {"status": "connected", "version": version_response.text}
            return {"status": "error", "message": f"Authentification OK mais erreur API: {version_response.status_code}"}
    except Exception as e:
        return {"status": "error", "message": f"Erreur connexion: {str(e)}"}

@admin_router.post("/settings/test-jackett")
async def test_jackett_connection(admin: dict = Depends(get_admin_user)):
    """Teste la connexion à Jackett"""
    config = await get_jackett_config()
    if not config:
        return {"status": "error", "message": "Jackett non configuré"}
    
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(
                f"{config['url']}/api/v2.0/server/config",
                params={"apikey": config['api_key']}
            )
            if response.status_code == 200:
                return {"status": "connected"}
            elif response.status_code == 302:
                return {"status": "error", "message": "Redirection détectée - vérifiez l'URL Jackett"}
            else:
                return {"status": "error", "message": f"Code HTTP {response.status_code}: {response.text[:100]}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# User management
@admin_router.get("/users", response_model=List[UserResponse])
async def get_users(admin: dict = Depends(get_admin_user)):
    """Récupère la liste des utilisateurs"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    # Add group names
    for user in users:
        if user.get("group_id"):
            group = await db.groups.find_one({"id": user["group_id"]}, {"_id": 0})
            if group:
                user["group_name"] = group.get("name")
    
    return users

@admin_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, admin: dict = Depends(get_admin_user)):
    """Récupère un utilisateur par ID"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    if user.get("group_id"):
        group = await db.groups.find_one({"id": user["group_id"]}, {"_id": 0})
        if group:
            user["group_name"] = group.get("name")
    
    return user

@admin_router.put("/users/{user_id}")
async def update_user(user_id: str, user_update: UserUpdate, admin: dict = Depends(get_admin_user)):
    """Met à jour un utilisateur"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    return {"message": "Utilisateur mis à jour avec succès"}

@admin_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    """Supprime un utilisateur"""
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    await db.users.delete_one({"id": user_id})
    # Also delete user's torrents
    await db.torrents.delete_many({"user_id": user_id})
    await db.notifications.delete_many({"user_id": user_id})
    
    return {"message": "Utilisateur supprimé avec succès"}

@admin_router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, admin: dict = Depends(get_admin_user)):
    """Réinitialise le mot de passe d'un utilisateur"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Generate temporary password
    temp_password = str(uuid.uuid4())[:12]
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(temp_password)}}
    )
    
    return {"message": "Mot de passe réinitialisé", "temporary_password": temp_password}

# Group management
@admin_router.get("/groups", response_model=List[GroupResponse])
async def get_groups(admin: dict = Depends(get_admin_user)):
    """Récupère la liste des groupes"""
    groups = await db.groups.find({}, {"_id": 0}).to_list(100)
    
    # Add user count for each group
    for group in groups:
        user_count = await db.users.count_documents({"group_id": group["id"]})
        group["user_count"] = user_count
    
    return groups

@admin_router.post("/groups", response_model=GroupResponse)
async def create_group(group_data: GroupCreate, admin: dict = Depends(get_admin_user)):
    """Crée un nouveau groupe"""
    existing = await db.groups.find_one({"name": group_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Un groupe avec ce nom existe déjà")
    
    group_id = str(uuid.uuid4())
    group = {
        "id": group_id,
        "name": group_data.name,
        "description": group_data.description,
        "max_torrents": group_data.max_torrents,
        "max_download_speed": group_data.max_download_speed,
        "max_upload_speed": group_data.max_upload_speed,
        "can_use_jackett": group_data.can_use_jackett,
        "can_see_all_torrents": group_data.can_see_all_torrents,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.groups.insert_one(group)
    
    return GroupResponse(**group, user_count=0)

@admin_router.put("/groups/{group_id}")
async def update_group(group_id: str, group_update: GroupUpdate, admin: dict = Depends(get_admin_user)):
    """Met à jour un groupe"""
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")
    
    update_data = {k: v for k, v in group_update.model_dump().items() if v is not None}
    
    if update_data:
        await db.groups.update_one({"id": group_id}, {"$set": update_data})
    
    return {"message": "Groupe mis à jour avec succès"}

@admin_router.delete("/groups/{group_id}")
async def delete_group(group_id: str, admin: dict = Depends(get_admin_user)):
    """Supprime un groupe"""
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")
    
    # Check if default group
    if group.get("name") == "Défaut":
        raise HTTPException(status_code=400, detail="Le groupe par défaut ne peut pas être supprimé")
    
    # Move users to default group
    default_group = await db.groups.find_one({"name": "Défaut"})
    if default_group:
        await db.users.update_many(
            {"group_id": group_id},
            {"$set": {"group_id": default_group["id"]}}
        )
    else:
        await db.users.update_many(
            {"group_id": group_id},
            {"$set": {"group_id": None}}
        )
    
    await db.groups.delete_one({"id": group_id})
    
    return {"message": "Groupe supprimé avec succès"}

# Admin stats
@admin_router.get("/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    """Récupère les statistiques globales pour l'admin"""
    user_count = await db.users.count_documents({})
    group_count = await db.groups.count_documents({})
    torrent_count = await db.torrents.count_documents({})
    active_users = await db.users.count_documents({"is_active": True})
    
    return {
        "total_users": user_count,
        "active_users": active_users,
        "total_groups": group_count,
        "total_torrents": torrent_count
    }

# ==================== TORRENT ROUTES ====================

@torrent_router.post("/add", response_model=dict)
async def add_torrent(
    torrent_data: TorrentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Ajoute un torrent via lien magnet"""
    # Check group limits
    if current_user.get("group_id"):
        group = await db.groups.find_one({"id": current_user["group_id"]})
        if group:
            user_torrent_count = await db.torrents.count_documents({"user_id": current_user["id"]})
            if user_torrent_count >= group.get("max_torrents", 100):
                raise HTTPException(status_code=403, detail=f"Limite de {group['max_torrents']} torrents atteinte pour votre groupe")
    
    try:
        # Ajouter à qBittorrent
        response = await qbit_request(
            "POST",
            "/api/v2/torrents/add",
            data={"urls": torrent_data.magnet}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Erreur lors de l'ajout du torrent à qBittorrent")
        
        # Extraire le hash du magnet
        torrent_hash = ""
        if "btih:" in torrent_data.magnet.lower():
            parts = torrent_data.magnet.lower().split("btih:")
            if len(parts) > 1:
                torrent_hash = parts[1].split("&")[0]
        
        # Sauvegarder en base de données
        torrent_id = str(uuid.uuid4())
        torrent_doc = {
            "id": torrent_id,
            "user_id": current_user["id"],
            "username": current_user["username"],
            "name": torrent_data.name,
            "magnet": torrent_data.magnet,
            "hash": torrent_hash,
            "status": "downloading",
            "progress": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.torrents.insert_one(torrent_doc)
        
        return {"message": "Torrent ajouté avec succès", "id": torrent_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur ajout torrent: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")

@torrent_router.post("/add-file", response_model=dict)
async def add_torrent_file(
    file: UploadFile = File(...),
    name: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Ajoute un torrent via fichier .torrent"""
    # Check group limits
    if current_user.get("group_id"):
        group = await db.groups.find_one({"id": current_user["group_id"]})
        if group:
            user_torrent_count = await db.torrents.count_documents({"user_id": current_user["id"]})
            if user_torrent_count >= group.get("max_torrents", 100):
                raise HTTPException(status_code=403, detail=f"Limite de {group['max_torrents']} torrents atteinte pour votre groupe")
    
    try:
        content = await file.read()
        
        # Ajouter à qBittorrent
        response = await qbit_request(
            "POST",
            "/api/v2/torrents/add",
            files={"torrents": (file.filename, content, "application/x-bittorrent")}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Erreur lors de l'ajout du torrent")
        
        # Sauvegarder en base de données
        torrent_id = str(uuid.uuid4())
        torrent_doc = {
            "id": torrent_id,
            "user_id": current_user["id"],
            "username": current_user["username"],
            "name": name,
            "magnet": "",
            "hash": "",
            "status": "downloading",
            "progress": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.torrents.insert_one(torrent_doc)
        
        return {"message": "Fichier torrent ajouté avec succès", "id": torrent_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur ajout fichier torrent: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")

@torrent_router.get("/my", response_model=List[TorrentResponse])
async def get_my_torrents(current_user: dict = Depends(get_current_user)):
    """Récupère les torrents de l'utilisateur connecté avec leur progression"""
    torrents = await db.torrents.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(1000)
    
    # Récupérer les infos de progression depuis qBittorrent
    try:
        response = await qbit_request("GET", "/api/v2/torrents/info")
        if response.status_code == 200:
            qbit_torrents = {t["hash"].lower(): t for t in response.json()}
            
            for torrent in torrents:
                torrent_hash = torrent.get("hash", "").lower()
                if torrent_hash and torrent_hash in qbit_torrents:
                    qt = qbit_torrents[torrent_hash]
                    torrent["progress"] = qt.get("progress", 0) * 100
                    torrent["download_speed"] = qt.get("dlspeed", 0)
                    torrent["upload_speed"] = qt.get("upspeed", 0)
                    torrent["size"] = qt.get("size", 0)
                    torrent["downloaded"] = qt.get("downloaded", 0)
                    torrent["eta"] = qt.get("eta", 0)
                    torrent["status"] = qt.get("state", "unknown")
                    
                    # Créer notification si terminé
                    if torrent["progress"] >= 100:
                        await create_completion_notification(torrent)
                else:
                    torrent["progress"] = torrent.get("progress", 0)
                    torrent["download_speed"] = 0
                    torrent["upload_speed"] = 0
                    torrent["size"] = 0
                    torrent["downloaded"] = 0
                    torrent["eta"] = 0
    except Exception as e:
        logger.warning(f"Impossible de récupérer les infos qBittorrent: {e}")
        for torrent in torrents:
            torrent["download_speed"] = 0
            torrent["upload_speed"] = 0
            torrent["size"] = 0
            torrent["downloaded"] = 0
            torrent["eta"] = 0
    
    return torrents

@torrent_router.get("/all", response_model=List[TorrentResponse])
async def get_all_torrents(current_user: dict = Depends(get_current_user)):
    """Récupère tous les torrents de tous les utilisateurs"""
    # Check group permission
    if current_user.get("group_id"):
        group = await db.groups.find_one({"id": current_user["group_id"]})
        if group and not group.get("can_see_all_torrents", True):
            raise HTTPException(status_code=403, detail="Votre groupe n'a pas accès à cette fonctionnalité")
    
    torrents = await db.torrents.find({}, {"_id": 0}).to_list(1000)
    
    # Récupérer les infos de progression depuis qBittorrent
    try:
        response = await qbit_request("GET", "/api/v2/torrents/info")
        if response.status_code == 200:
            qbit_torrents = {t["hash"].lower(): t for t in response.json()}
            
            for torrent in torrents:
                torrent_hash = torrent.get("hash", "").lower()
                if torrent_hash and torrent_hash in qbit_torrents:
                    qt = qbit_torrents[torrent_hash]
                    torrent["progress"] = qt.get("progress", 0) * 100
                    torrent["download_speed"] = qt.get("dlspeed", 0)
                    torrent["upload_speed"] = qt.get("upspeed", 0)
                    torrent["size"] = qt.get("size", 0)
                    torrent["downloaded"] = qt.get("downloaded", 0)
                    torrent["eta"] = qt.get("eta", 0)
                    torrent["status"] = qt.get("state", "unknown")
                else:
                    torrent["progress"] = torrent.get("progress", 0)
                    torrent["download_speed"] = 0
                    torrent["upload_speed"] = 0
                    torrent["size"] = 0
                    torrent["downloaded"] = 0
                    torrent["eta"] = 0
    except Exception as e:
        logger.warning(f"Impossible de récupérer les infos qBittorrent: {e}")
        for torrent in torrents:
            torrent["download_speed"] = 0
            torrent["upload_speed"] = 0
            torrent["size"] = 0
            torrent["downloaded"] = 0
            torrent["eta"] = 0
    
    return torrents

@torrent_router.delete("/{torrent_id}")
async def delete_torrent(torrent_id: str, current_user: dict = Depends(get_current_user)):
    """Supprime un torrent de l'utilisateur"""
    torrent = await db.torrents.find_one(
        {"id": torrent_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not torrent:
        raise HTTPException(status_code=404, detail="Torrent non trouvé")
    
    # Supprimer de qBittorrent
    if torrent.get("hash"):
        try:
            await qbit_request(
                "POST",
                "/api/v2/torrents/delete",
                data={"hashes": torrent["hash"], "deleteFiles": "true"}
            )
        except Exception as e:
            logger.warning(f"Erreur suppression qBittorrent: {e}")
    
    # Supprimer de la base de données
    await db.torrents.delete_one({"id": torrent_id})
    
    return {"message": "Torrent supprimé avec succès"}

@torrent_router.post("/{torrent_id}/pause")
async def pause_torrent(torrent_id: str, current_user: dict = Depends(get_current_user)):
    """Met en pause un torrent"""
    torrent = await db.torrents.find_one(
        {"id": torrent_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not torrent:
        raise HTTPException(status_code=404, detail="Torrent non trouvé")
    
    if torrent.get("hash"):
        try:
            # qBittorrent API v2 - utiliser 'stop' au lieu de 'pause' pour les versions récentes
            response = await qbit_request("POST", "/api/v2/torrents/stop", data={"hashes": torrent["hash"]})
            logger.info(f"Pause torrent response: {response.status_code}")
        except Exception as e:
            logger.error(f"Erreur pause torrent: {e}")
            raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")
    
    return {"message": "Torrent mis en pause"}

@torrent_router.post("/{torrent_id}/resume")
async def resume_torrent(torrent_id: str, current_user: dict = Depends(get_current_user)):
    """Reprend un torrent"""
    torrent = await db.torrents.find_one(
        {"id": torrent_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not torrent:
        raise HTTPException(status_code=404, detail="Torrent non trouvé")
    
    if torrent.get("hash"):
        try:
            # qBittorrent API v2 - utiliser 'start' au lieu de 'resume' pour les versions récentes
            response = await qbit_request("POST", "/api/v2/torrents/start", data={"hashes": torrent["hash"]})
            logger.info(f"Resume torrent response: {response.status_code}")
        except Exception as e:
            logger.error(f"Erreur resume torrent: {e}")
            raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")
    
    return {"message": "Torrent repris"}

@torrent_router.get("/stats", response_model=TorrentStats)
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Récupère les statistiques générales"""
    total = await db.torrents.count_documents({"user_id": current_user["id"]})
    
    stats = {
        "total_torrents": total,
        "active_torrents": 0,
        "completed_torrents": 0,
        "total_download_speed": 0,
        "total_upload_speed": 0
    }
    
    try:
        response = await qbit_request("GET", "/api/v2/transfer/info")
        if response.status_code == 200:
            transfer = response.json()
            stats["total_download_speed"] = transfer.get("dl_info_speed", 0)
            stats["total_upload_speed"] = transfer.get("up_info_speed", 0)
        
        response = await qbit_request("GET", "/api/v2/torrents/info")
        if response.status_code == 200:
            torrents = response.json()
            for t in torrents:
                if t.get("progress", 0) >= 1:
                    stats["completed_torrents"] += 1
                elif t.get("state") in ["downloading", "uploading", "stalledDL", "stalledUP"]:
                    stats["active_torrents"] += 1
    except Exception as e:
        logger.warning(f"Erreur récupération stats qBittorrent: {e}")
    
    return stats

# ==================== JACKETT ROUTES ====================

@jackett_router.get("/search", response_model=JackettSearchResponse)
async def search_jackett(
    query: str,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Recherche des torrents via Jackett"""
    # Check group permission
    if current_user.get("group_id"):
        group = await db.groups.find_one({"id": current_user["group_id"]})
        if group and not group.get("can_use_jackett", True):
            raise HTTPException(status_code=403, detail="Votre groupe n'a pas accès à la recherche Jackett")
    
    config = await get_jackett_config()
    if not config:
        raise HTTPException(status_code=503, detail="Jackett non configuré. Contactez un administrateur.")
    
    try:
        params = {
            "apikey": config["api_key"],
            "Query": query
        }
        if category:
            params["Category[]"] = category
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(
                f"{config['url']}/api/v2.0/indexers/all/results",
                params=params
            )
            
            logger.info(f"Jackett search response: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"Jackett error: {response.text[:200]}")
                raise HTTPException(status_code=response.status_code, detail=f"Erreur Jackett: {response.text[:100]}")
            
            try:
                data = response.json()
            except Exception as json_err:
                logger.error(f"Jackett JSON parse error: {response.text[:200]}")
                raise HTTPException(status_code=500, detail="Réponse Jackett invalide (pas du JSON)")
            
            results = []
            
            for item in data.get("Results", []):
                magnet = item.get("MagnetUri", "")
                if not magnet and item.get("Link"):
                    magnet = item.get("Link", "")
                
                results.append(JackettSearchResult(
                    title=item.get("Title", "Sans titre"),
                    size=item.get("Size", 0),
                    seeders=item.get("Seeders", 0),
                    leechers=item.get("Peers", 0),
                    magnet=magnet,
                    tracker=item.get("Tracker", "Inconnu"),
                    published=item.get("PublishDate", "")
                ))
            
            # Trier par nombre de seeders (décroissant)
            results.sort(key=lambda x: x.seeders, reverse=True)
            
            # Limiter à 50 résultats après le tri
            results = results[:50]
            
            return JackettSearchResponse(results=results, total=len(results))
    
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout Jackett - la recherche a pris trop de temps")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur recherche Jackett: {e}")
        raise HTTPException(status_code=503, detail=f"Service Jackett indisponible: {str(e)}")

@jackett_router.get("/indexers")
async def get_indexers(current_user: dict = Depends(get_current_user)):
    """Récupère la liste des indexeurs Jackett configurés"""
    config = await get_jackett_config()
    if not config:
        raise HTTPException(status_code=503, detail="Jackett non configuré")
    
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(
                f"{config['url']}/api/v2.0/indexers",
                params={"apikey": config['api_key']}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Erreur Jackett")
            
            indexers = response.json()
            return {"indexers": [{"id": i.get("id"), "name": i.get("name"), "configured": i.get("configured")} for i in indexers]}
    
    except Exception as e:
        logger.error(f"Erreur récupération indexeurs: {e}")
        raise HTTPException(status_code=503, detail="Service Jackett indisponible")

# ==================== NOTIFICATION ROUTES ====================

async def create_completion_notification(torrent: dict):
    """Crée une notification quand un torrent est terminé"""
    existing = await db.notifications.find_one({
        "torrent_id": torrent["id"],
        "user_id": torrent["user_id"]
    })
    
    if not existing:
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": torrent["user_id"],
            "torrent_id": torrent["id"],
            "torrent_name": torrent["name"],
            "message": f"Le téléchargement de '{torrent['name']}' est terminé !",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)

@notification_router.get("/", response_model=List[NotificationResponse])
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """Récupère les notifications de l'utilisateur"""
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return notifications

@notification_router.get("/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Récupère le nombre de notifications non lues"""
    count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "read": False
    })
    return {"count": count}

@notification_router.post("/{notification_id}/read")
async def mark_as_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Marque une notification comme lue"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification non trouvée")
    
    return {"message": "Notification marquée comme lue"}

@notification_router.post("/read-all")
async def mark_all_as_read(current_user: dict = Depends(get_current_user)):
    """Marque toutes les notifications comme lues"""
    await db.notifications.update_many(
        {"user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    
    return {"message": "Toutes les notifications marquées comme lues"}

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "QBitMaster API v1.0", "status": "ok"}

@api_router.get("/health")
async def health_check():
    """Vérifie l'état des services"""
    status = {
        "api": "ok",
        "database": "ok",
        "qbittorrent": "unknown",
        "jackett": "unknown"
    }
    
    # Check MongoDB
    try:
        await db.command("ping")
    except Exception:
        status["database"] = "error"
    
    # Check qBittorrent
    config = await get_qbit_config()
    if config:
        try:
            response = await qbit_request("GET", "/api/v2/app/version")
            if response.status_code == 200:
                status["qbittorrent"] = "ok"
            else:
                status["qbittorrent"] = "error"
        except Exception:
            status["qbittorrent"] = "error"
    else:
        status["qbittorrent"] = "not_configured"
    
    # Check Jackett
    jackett_config = await get_jackett_config()
    if jackett_config:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{jackett_config['url']}/api/v2.0/server/config",
                    params={"apikey": jackett_config['api_key']}
                )
                if response.status_code == 200:
                    status["jackett"] = "ok"
                else:
                    status["jackett"] = "error"
        except Exception:
            status["jackett"] = "error"
    else:
        status["jackett"] = "not_configured"
    
    return status

# ==================== INCLUDE ROUTERS ====================

api_router.include_router(auth_router)
api_router.include_router(torrent_router)
api_router.include_router(jackett_router)
api_router.include_router(notification_router)
api_router.include_router(admin_router)
app.include_router(api_router)

# ==================== MIDDLEWARE ====================

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== STARTUP/SHUTDOWN ====================

@app.on_event("startup")
async def startup():
    """Initialisation au démarrage"""
    logger.info("QBitMaster API démarré")
    # Créer les index MongoDB
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.torrents.create_index("user_id")
    await db.torrents.create_index("hash")
    await db.notifications.create_index("user_id")
    await db.groups.create_index("name", unique=True)
    
    # Créer le groupe par défaut s'il n'existe pas
    default_group = await db.groups.find_one({"name": "Défaut"})
    if not default_group:
        await db.groups.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Défaut",
            "description": "Groupe par défaut pour les nouveaux utilisateurs",
            "max_torrents": 100,
            "max_download_speed": 0,
            "max_upload_speed": 0,
            "can_use_jackett": True,
            "can_see_all_torrents": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Groupe par défaut créé")
    
    # Tenter connexion qBittorrent
    await qbit_login()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
