# QBitMaster - PRD (Product Requirements Document)

## Problème Initial
Créer un site web complet multi-utilisateurs en français pour gérer des torrents via un seul qBittorrent central, avec intégration Jackett pour recherche de torrents, et un panneau d'administration complet.

## Architecture

### Stack Technique
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Base de données**: MongoDB
- **Authentification**: JWT

### Structure Backend
```
/app/backend/
├── server.py          # API FastAPI complète avec admin
└── .env               # Configuration
```

### Structure Frontend
```
/app/frontend/src/
├── App.js             # Routing (user + admin routes)
├── contexts/
│   └── AuthContext.js # Authentification JWT
├── components/
│   └── Layout.js      # Sidebar avec section admin
└── pages/
    ├── LoginPage.js
    ├── DashboardPage.js
    ├── MyTorrentsPage.js
    ├── AllTorrentsPage.js
    ├── JackettSearchPage.js
    ├── AdminSettingsPage.js    # Configuration qBittorrent/Jackett
    ├── AdminUsersPage.js       # Gestion utilisateurs
    └── AdminGroupsPage.js      # Gestion groupes
```

## User Personas

### Utilisateur Standard
- S'inscrit et se connecte
- Gère ses propres torrents
- Recherche via Jackett (si groupe autorisé)
- Reçoit des notifications

### Administrateur
- Toutes les fonctionnalités utilisateur
- Configure qBittorrent et Jackett
- Gère les utilisateurs (CRUD, rôles, groupes)
- Gère les groupes (permissions, limites)

## Ce qui a été implémenté (Date: 2026-02-08)

### Phase 1 - Core Features ✅
- Authentification JWT (inscription/connexion)
- Dashboard avec statistiques temps réel
- Page Mes torrents (ajout magnet/fichier, suppression, pause, reprise)
- Page Tous les torrents
- Recherche Jackett avec tri par seeders
- Notifications (torrent terminé)
- **Synchronisation hash torrents avec qBittorrent** (CORRIGÉ 2026-02-08)

### Phase 2 - Administration ✅
- **Page Paramètres Admin**:
  - Configuration qBittorrent (host, port, username, password, HTTPS)
  - Configuration Jackett (URL, API key)
  - **Configuration téléchargements sécurisés** (URLs signées avec Nginx)
  - Test de connexion pour chaque service
  - Stockage en base de données

- **Page Utilisateurs Admin**:
  - Liste de tous les utilisateurs
  - Statistiques (total, actifs, admins, inactifs)
  - Modification (username, email, rôle, groupe, statut)
  - Suppression d'utilisateur
  - Réinitialisation de mot de passe

- **Page Groupes Admin**:
  - CRUD complet des groupes
  - Permissions par groupe:
    - max_torrents: limite de torrents
    - max_download_speed: limite vitesse DL
    - max_upload_speed: limite vitesse UP
    - can_use_jackett: accès recherche
    - can_see_all_torrents: accès vue globale
  - Groupe "Défaut" créé automatiquement
  - Compteur d'utilisateurs par groupe

### API Routes
```
# Auth
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me

# Torrents
POST /api/torrents/add
POST /api/torrents/add-file
GET  /api/torrents/my
GET  /api/torrents/all
DELETE /api/torrents/{id}
POST /api/torrents/{id}/pause
POST /api/torrents/{id}/resume
GET  /api/torrents/stats

# Jackett
GET  /api/jackett/search
GET  /api/jackett/indexers

# Notifications
GET  /api/notifications/
GET  /api/notifications/unread-count
POST /api/notifications/{id}/read
POST /api/notifications/read-all

# Admin
GET  /api/admin/settings
POST /api/admin/settings/qbittorrent
POST /api/admin/settings/jackett
POST /api/admin/settings/test-qbittorrent
POST /api/admin/settings/test-jackett
GET  /api/admin/users
GET  /api/admin/users/{id}
PUT  /api/admin/users/{id}
DELETE /api/admin/users/{id}
POST /api/admin/users/{id}/reset-password
GET  /api/admin/groups
POST /api/admin/groups
PUT  /api/admin/groups/{id}
DELETE /api/admin/groups/{id}
GET  /api/admin/stats
```

## Backlog Priorisé

### P0 - Configuration (Utilisateur)
- [ ] Configurer qBittorrent via l'interface admin
- [ ] Configurer Jackett via l'interface admin

### P1 - Important
- [ ] Téléchargement de fichiers terminés
- [ ] Application des limites de vitesse par groupe
- [ ] Historique des actions admin

### P2 - Améliorations
- [ ] Graphiques de vitesse temps réel
- [ ] Export statistiques CSV
- [ ] Logs d'audit admin
- [ ] Thème clair/sombre toggle

## Notes Techniques
- Le premier utilisateur inscrit devient automatiquement admin
- Les paramètres sont stockés dans la collection MongoDB `settings`
- Le groupe "Défaut" ne peut pas être supprimé
- Les utilisateurs supprimés voient leurs torrents également supprimés
