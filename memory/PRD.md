# QBitMaster - PRD (Product Requirements Document)

## Problème Initial
Créer un site web complet multi-utilisateurs en français pour gérer des torrents via un seul qBittorrent central, avec intégration Jackett pour recherche de torrents.

## Architecture

### Stack Technique
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Base de données**: MongoDB
- **Authentification**: JWT

### Structure Backend
```
/app/backend/
├── server.py          # API FastAPI complète
└── .env               # Configuration (qBittorrent, Jackett, JWT)
```

### Structure Frontend
```
/app/frontend/src/
├── App.js             # Routing principal
├── contexts/
│   └── AuthContext.js # Gestion authentification JWT
├── components/
│   └── Layout.js      # Sidebar + Header + Notifications
└── pages/
    ├── LoginPage.js        # Connexion / Inscription
    ├── DashboardPage.js    # Tableau de bord avec stats
    ├── MyTorrentsPage.js   # Gestion torrents utilisateur
    ├── AllTorrentsPage.js  # Vue tous les torrents
    └── JackettSearchPage.js # Recherche Jackett
```

## User Personas

### Utilisateur Standard
- Peut s'inscrire et se connecter
- Gère ses propres torrents (ajout, suppression, pause, reprise)
- Voit la progression en temps réel
- Reçoit des notifications quand un torrent est terminé
- Peut rechercher des torrents via Jackett

## Core Requirements (Statiques)

### Authentification
- [x] Inscription avec username, email, mot de passe
- [x] Connexion avec email/mot de passe
- [x] Protection des routes par JWT
- [x] Hashage des mots de passe (SHA256)

### Gestion Torrents
- [x] Ajout via lien magnet
- [x] Ajout via fichier .torrent
- [x] Suppression de torrent
- [x] Pause/Reprise de torrent
- [x] Progression en temps réel (polling 3s)

### Intégrations
- [x] API qBittorrent (add, delete, pause, resume, info)
- [x] API Jackett (recherche, catégories)

### Notifications
- [x] Notification quand torrent terminé
- [x] Compteur non lus
- [x] Marquer comme lu (individuel/tous)

## Ce qui a été implémenté (Date: 2026-02-04)

### Backend
- Routes auth: /api/auth/register, /api/auth/login, /api/auth/me
- Routes torrents: /api/torrents/add, /api/torrents/add-file, /api/torrents/my, /api/torrents/all, /api/torrents/{id}/pause, /api/torrents/{id}/resume, /api/torrents/{id} (DELETE)
- Routes Jackett: /api/jackett/search, /api/jackett/indexers
- Routes notifications: /api/notifications/, /api/notifications/unread-count, /api/notifications/{id}/read, /api/notifications/read-all
- Health check: /api/health

### Frontend
- Page login/register avec tabs
- Dashboard avec stats (vitesses, totaux)
- Page Mes torrents avec table et actions
- Page Tous les torrents avec recherche
- Page Recherche Jackett avec filtres catégorie
- Sidebar responsive avec navigation
- Header avec notifications dropdown et menu utilisateur
- Design dark mode professionnel

## Backlog Priorisé

### P0 - Critique (Configuration utilisateur requise)
- [ ] Configurer les variables d'environnement qBittorrent (QBIT_HOST, QBIT_USERNAME, QBIT_PASSWORD)
- [ ] Configurer Jackett (JACKETT_URL, JACKETT_API_KEY)

### P1 - Important
- [ ] Téléchargement de fichiers terminés
- [ ] Filtres avancés sur les listes de torrents
- [ ] Pagination des résultats

### P2 - Améliorations
- [ ] Graphiques de vitesse temps réel
- [ ] Thème clair/sombre toggle
- [ ] Export statistiques
- [ ] Historique des téléchargements

## Next Tasks
1. L'utilisateur doit configurer ses identifiants qBittorrent dans /app/backend/.env
2. L'utilisateur doit configurer son API key Jackett dans /app/backend/.env
3. Redémarrer le backend après configuration: `sudo supervisorctl restart backend`
