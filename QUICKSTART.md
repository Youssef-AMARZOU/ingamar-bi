# INGAMAR - Guide de Démarrage Rapide

## 🎉 Projet Déployé avec Succès!

Votre plateforme **INGAMAR by AMARZOU** est maintenant opérationnelle.

## 🌐 Accès à l'Application

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Interface utilisateur React |
| **Backend API** | http://localhost:8088 | API REST Flask |
| **PostgreSQL** | localhost:5432 | Base de données |
| **Redis** | localhost:6379 | Cache & Message Broker |

## 🔑 Identifiants Admin

- **Username**: `admin`
- **Password**: `admin`
- **Email**: admin@ingamar.com

## 📋 Commandes Utiles

```powershell
# Naviguer vers le projet
cd C:\Users\youss\ingamar

# Voir l'état des conteneurs
docker compose ps

# Voir les logs
docker compose logs -f

# Arrêter tous les services
docker compose down

# Redémarrer un service
docker compose restart ingamar

# Reconstruire après modifications
docker compose up -d --build
```

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │
│   React     │     │   Flask     │     │             │
│   :3000     │     │   :8088     │     │   :5432     │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │    Redis    │
                    │   :6379     │
                    └─────────────┘
```

## 👥 Rôles Disponibles

| Rôle | Permissions |
|------|-------------|
| **Admin** | Accès complet au système |
| **Data Engineer** | BDD, datasets, SQL Lab |
| **Analyst** | Charts, dashboards, exploration |
| **Contributor** | Créer/modifier ses assets |
| **Reviewer** | Approuver/rejeter contributions |
| **Viewer** | Lecture seule |

## 📁 Structure du Projet

```
ingamar/
├── backend/           # API Flask
│   ├── app/
│   │   ├── api/       # Endpoints API
│   │   ├── auth/      # Authentification
│   │   ├── charts/    # Gestion des charts
│   │   ├── dashboards/# Gestion des dashboards
│   │   ├── models/    # Modèles SQLAlchemy
│   │   ├── roles/     # Système de rôles
│   │   ── sql_lab/   # Éditeur SQL
│   └── requirements.txt
├── frontend/          # Interface React
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── store/
│   └── package.json
├── docker/            # Configuration Docker
└── docker-compose.yml
```

## 🔧 Développement

### Modifier le Backend
1. Éditez les fichiers dans `backend/app/`
2. Reconstruisez: `docker compose up -d --build ingamar`

### Modifier le Frontend
1. Éditez les fichiers dans `frontend/src/`
2. Les changements sont automatiquement rechargés (hot reload)

##  Prochaines Étapes

1. Connectez-vous à http://localhost:3000 avec admin/admin
2. Ajoutez une base de données dans "Databases"
3. Créez des datasets et des charts
4. Construisez vos dashboards

---

**Développé avec ❤️ par AMARZOU**
