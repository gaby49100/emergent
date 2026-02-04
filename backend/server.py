# QBitMaster - Backend FastAPI
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
import base64

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

# qBittorrent Configuration
QBIT_HOST = os.environ.get('QBIT_HOST', 'http://localhost:8080')
QBIT_USERNAME = os.environ.get('QBIT_USERNAME', 'admin')
QBIT_PASSWORD = os.environ.get('QBIT_PASSWORD', 'adminadmin')

# Jackett Configuration
JACKETT_URL = os.environ.get('JACKETT_URL', 'http://localhost:9117')
JACKETT_API_KEY = os.environ.get('JACKETT_API_KEY', '')

# Create the main app
app = FastAPI(title="QBitMaster API", description="API de gestion de torrents multi-utilisateurs")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth", tags=["Authentification"])
torrent_router = APIRouter(prefix="/torrents", tags=["Torrents"])
jackett_router = APIRouter(prefix="/jackett", tags=["Jackett"])
notification_router = APIRouter(prefix="/notifications", tags=["Notifications"])

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
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

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

def create_token(user_id: str, username: str) -> str:
    """Crée un token JWT"""
    payload = {
        "user_id": user_id,
        "username": username,
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
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

# qBittorrent session management
qbit_session_cookie = None

async def qbit_login():
    """Connexion à qBittorrent et récupération du cookie de session"""
    global qbit_session_cookie
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{QBIT_HOST}/api/v2/auth/login",
                data={"username": QBIT_USERNAME, "password": QBIT_PASSWORD}
            )
            if response.status_code == 200 and response.text == "Ok.":
                qbit_session_cookie = response.cookies.get("SID")
                logger.info("Connexion qBittorrent réussie")
                return True
            else:
                logger.error(f"Échec connexion qBittorrent: {response.text}")
                return False
    except Exception as e:
        logger.error(f"Erreur connexion qBittorrent: {e}")
        return False

async def qbit_request(method: str, endpoint: str, **kwargs):
    """Effectue une requête à l'API qBittorrent"""
    global qbit_session_cookie
    
    if not qbit_session_cookie:
        await qbit_login()
    
    try:
        async with httpx.AsyncClient() as client:
            cookies = {"SID": qbit_session_cookie} if qbit_session_cookie else {}
            
            if method.upper() == "GET":
                response = await client.get(f"{QBIT_HOST}{endpoint}", cookies=cookies, **kwargs)
            else:
                response = await client.post(f"{QBIT_HOST}{endpoint}", cookies=cookies, **kwargs)
            
            # Si non autorisé, reconnexion et retry
            if response.status_code == 403:
                await qbit_login()
                cookies = {"SID": qbit_session_cookie} if qbit_session_cookie else {}
                if method.upper() == "GET":
                    response = await client.get(f"{QBIT_HOST}{endpoint}", cookies=cookies, **kwargs)
                else:
                    response = await client.post(f"{QBIT_HOST}{endpoint}", cookies=cookies, **kwargs)
            
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
    
    # Créer l'utilisateur
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    
    # Créer le token
    token = create_token(user_id, user_data.username)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            username=user_data.username,
            email=user_data.email,
            created_at=user["created_at"]
        )
    )

@auth_router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Connexion d'un utilisateur"""
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    token = create_token(user["id"], user["username"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            email=user["email"],
            created_at=user["created_at"]
        )
    )

@auth_router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Récupère les informations de l'utilisateur connecté"""
    return UserResponse(**current_user)

# ==================== TORRENT ROUTES ====================

@torrent_router.post("/add", response_model=dict)
async def add_torrent(
    torrent_data: TorrentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Ajoute un torrent via lien magnet"""
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
        await qbit_request("POST", "/api/v2/torrents/pause", data={"hashes": torrent["hash"]})
    
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
        await qbit_request("POST", "/api/v2/torrents/resume", data={"hashes": torrent["hash"]})
    
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
    if not JACKETT_API_KEY:
        raise HTTPException(status_code=503, detail="Jackett non configuré (API key manquante)")
    
    try:
        params = {
            "apikey": JACKETT_API_KEY,
            "Query": query
        }
        if category:
            params["Category[]"] = category
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{JACKETT_URL}/api/v2.0/indexers/all/results",
                params=params
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Erreur Jackett")
            
            data = response.json()
            results = []
            
            for item in data.get("Results", [])[:50]:  # Limiter à 50 résultats
                magnet = item.get("MagnetUri", "")
                if not magnet and item.get("Link"):
                    # Utiliser le lien de téléchargement si pas de magnet
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
            
            return JackettSearchResponse(results=results, total=len(results))
    
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout Jackett - la recherche a pris trop de temps")
    except Exception as e:
        logger.error(f"Erreur recherche Jackett: {e}")
        raise HTTPException(status_code=503, detail=f"Service Jackett indisponible: {str(e)}")

@jackett_router.get("/indexers")
async def get_indexers(current_user: dict = Depends(get_current_user)):
    """Récupère la liste des indexeurs Jackett configurés"""
    if not JACKETT_API_KEY:
        raise HTTPException(status_code=503, detail="Jackett non configuré")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{JACKETT_URL}/api/v2.0/indexers",
                params={"apikey": JACKETT_API_KEY}
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
    try:
        response = await qbit_request("GET", "/api/v2/app/version")
        if response.status_code == 200:
            status["qbittorrent"] = "ok"
        else:
            status["qbittorrent"] = "error"
    except Exception:
        status["qbittorrent"] = "error"
    
    # Check Jackett
    if JACKETT_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{JACKETT_URL}/api/v2.0/server/config",
                    params={"apikey": JACKETT_API_KEY}
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
    
    # Tenter connexion qBittorrent
    await qbit_login()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
