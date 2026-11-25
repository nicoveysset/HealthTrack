# HealthTrack — Gestion de cabinet médical

**Solution complète pour la gestion des rendez-vous, dossiers médicaux, ordonnances et disponibilités sur AWS.**

## 📋 À propos

HealthTrack est une application web conçue pour les **cabinets médicaux** qui permet de gérer :
- Les **utilisateurs** (patients et praticiens)
- Les **disponibilités** des praticiens
- Les **rendez-vous** (prise, confirmation, annulation, statut)
- Les **comptes rendus** de consultation
- Les **dossiers médicaux** (antécédents, allergies, vaccinations)
- Les **ordonnances** et médicaments

## 🏗️ Architecture

### Backend (Serverless)

```
Frontend (React) → CloudFront → S3
        ↓
API Gateway x4 → Lambda x4 → DynamoDB (12 tables)
        ↓
Cognito (Authentification)
        ↓
CloudWatch (Logs)
```

**Composants :**
- **4 API Gateways** : Une par domaine métier
- **4 Lambdas** : `api-utilisateurs`, `api-disponibilites-rdv`, `api-dossiers-medicaux`, `api-ordonnances`
- **DynamoDB** : 12 tables avec GSIs pour les requêtes complexes
- **Cognito** : User Pool pour l'authentification JWT
- **S3 + CloudFront** : Hébergement statique du frontend

### Frontend (React)

- **Framework** : React 18 + Vite
- **Routing** : React Router v6
- **Authentification** : JWT avec Cognito
- **UI** : Composants personnalisés + CSS moderne

## 📁 Structure du projet

```
/healthtrack
├── api-utilisateurs/          # API pour la gestion des utilisateurs
│   ├── src/
│   │   ├── handlers/          # Handlers Lambda
│   │   ├── models/            # Modèles de données
│   │   └── services/          # Services métier
│   ├── package.json
│   └── README.md
│
├── api-disponibilites-rdv/   # API pour les disponibilités et RDV
│   ├── src/
│   │   └── handlers/
│   ├── package.json
│   └── README.md
│
├── api-dossiers-medicaux/    # API pour les dossiers médicaux
│   ├── src/
│   │   └── handlers/
│   ├── package.json
│   └── README.md
│
├── api-ordonnances/           # API pour les ordonnances
│   ├── src/
│   │   └── handlers/
│   ├── package.json
│   └── README.md
│
├── frontend/                  # Application React
│   ├── public/
│   ├── src/
│   │   ├── components/        # Composants React
│   │   ├── pages/             # Pages
│   │   ├── services/          # Services API
│   │   └── styles/            # Styles CSS
│   ├── package.json
│   └── vite.config.js
│
├── infrastructure/            # Scripts de déploiement AWS
│   ├── deploy-all.sh          # Script principal
│   ├── deploy-cognito.sh
│   ├── deploy-dynamodb.sh
│   ├── deploy-lambdas.sh
│   ├── deploy-apigateway.sh
│   ├── deploy-frontend.sh
│   ├── cleanup.sh             # Nettoyage des ressources
│   └── README.md
│
├── docs/                      # Documentation
│   └── contrats.md            # Contrats API et schéma DynamoDB
│
├── .gitignore
├── PLAN.md                    # Plan complet du projet
├── MISTRAL.md                 # Tâches à accomplir
└── README.md                  # Ce fichier
```

## 🚀 Déploiement

### Prérequis

1. **Compte AWS** avec permissions administrateur
2. **AWS CLI** installé et configuré
   ```bash
   aws --version
   aws configure
   ```
3. **Node.js 18+**
4. **jq** installé (pour parser JSON)
   ```bash
   # Ubuntu/Debian
   sudo apt-get install jq
   
   # macOS
   brew install jq
   ```

### Étapes de déploiement

1. **Cloner le dépôt**
   ```bash
   git clone <url-du-repo>
   cd healthtrack
   ```

2. **Déployer l'infrastructure**
   ```bash
   cd infrastructure
   chmod +x *.sh
   ./deploy-all.sh
   ```

3. **Configurer le frontend**
   - Mettre à jour les URLs des APIs dans `frontend/src/main.jsx`
   - Builder le frontend :
     ```bash
     cd ../frontend
     npm install
     npm run build
     ```
   - Uploader le build :
     ```bash
     cd ../infrastructure
     ./deploy-frontend.sh
     ```

4. **Accéder à l'application**
   - Frontend : URL CloudFront affichée à la fin du déploiement
   - APIs : URLs des API Gateways

### Déploiement manuel

Si vous préférez déployer étape par étape :

```bash
# 1. Cognito
./deploy-cognito.sh

# 2. DynamoDB
./deploy-dynamodb.sh

# 3. Lambdas
./deploy-lambdas.sh

# 4. API Gateway
./deploy-apigateway.sh

# 5. Frontend
./deploy-frontend.sh
```

## 🛠 Développement local

### Backend (Lambdas)

Chaque API est un projet Node.js indépendant :

```bash
# API Utilisateurs
cd api-utilisateurs
npm install
npm run dev  # Utilise nodemon pour le développement

# API RDV
cd ../api-disponibilites-rdv
npm install
npm run dev

# etc.
```

### Frontend

```bash
cd frontend
npm install
npm run dev  # Démarre le serveur de développement sur http://localhost:3000
```

### DynamoDB Local

Pour tester sans AWS :

```bash
# Démarrer DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Créer les tables avec AWS CLI (endpoint local)
aws dynamodb create-table --endpoint-url http://localhost:8000 ...
```

### LocalStack

Émule tous les services AWS :

```bash
# Démarrer LocalStack
docker run -d -p 4566:4566 localstack/localstack

# Configurer AWS CLI pour LocalStack
aws --endpoint-url=http://localhost:4566 cognito-idp create-user-pool ...
```

## 📚 Documentation

- **PLAN.md** : Plan complet du projet (architecture, routes, modèle de données)
- **MISTRAL.md** : Tâches à accomplir et suivi du développement
- **infrastructure/README.md** : Documentation détaillée du déploiement
- **api-utilisateurs/README.md** : Documentation de l'API Utilisateurs

## 🎯 Fonctionnalités

### Utilisateurs
- ✅ Inscription (patient/praticien)
- ✅ Connexion/Déconnexion
- ✅ Gestion du profil
- ✅ Désignation du médecin traitant (patient uniquement)
- ✅ Changement de statut (praticien uniquement)
- ✅ Recherche de praticiens (paginé/filtré)

### Disponibilités & Rendez-vous
- ✅ Définition des créneaux hebdomadaires
- ✅ Gestion des indisponibilités ponctuelles
- ✅ Calcul des créneaux disponibles
- ✅ Prise de rendez-vous
- ✅ Transitions de statut (PLANIFIE → CONFIRME → EN_COURS → TERMINE)
- ✅ Statut NON_VENU
- ✅ Rédaction de comptes rendus (sur RDV TERMINE uniquement)

### Dossiers Médicaux
- ✅ Consultation du dossier complet
- ✅ CRUD des antécédents
- ✅ Archivage des antécédents (sauf chroniques)
- ✅ CRUD des allergies
- ✅ Logs CloudWatch pour les modifications d'allergies
- ✅ CRUD des vaccinations
- ✅ Vérification d'accès (praticien doit avoir consulté le patient)

### Ordonnances
- ✅ Création d'ordonnances (sur compte rendu finalisé)
- ✅ Expiration paresseuse (3 mois par défaut)
- ✅ CRUD des lignes de prescription
- ✅ Vérification des conflits d'allergies
- ✅ Alerte CloudWatch pour durée > 90 jours
- ✅ CRUD des médicaments

## 🔒 Sécurité

- **Authentification** : JWT avec Cognito
- **Authorisation** : Vérification des rôles sur chaque route
- **Chiffrement** : Mots de passe hashés avec BCrypt
- **HTTPS** : Toutes les communications via HTTPS (CloudFront)
- **CORS** : Configuré sur les API Gateways

## 📊 Données

### Tables DynamoDB

| Table | Description | Clés | GSIs |
|-------|-------------|------|------|
| `healthtrack-utilisateurs` | Utilisateurs (patients + praticiens) | userId | byEmail, byMedecinTraitant |
| `healthtrack-dossiers-medicaux` | Dossiers médicaux | patientId | - |
| `healthtrack-antecedents` | Antécédents médicaux | antecedentId | byDossier, byDossierAndType, byStatut |
| `healthtrack-allergies` | Allergies | allergieId | byPatient |
| `healthtrack-vaccinations` | Vaccinations | vaccinationId | byDossier, byDossierAndNom |
| `healthtrack-disponibilites` | Disponibilités hebdomadaires | dispoId | byPraticien, byPraticienAndJour |
| `healthtrack-indisponibilites` | Indisponibilités ponctuelles | indispoId | byPraticien, byPraticienAndDate |
| `healthtrack-rendezvous` | Rendez-vous | rdvId | byPraticienAndDate, byPatientAndDate, byStatut |
| `healthtrack-comptes-rendus` | Comptes rendus | compteRenduId | byRdv, byPraticien, byPatient |
| `healthtrack-ordonnances` | Ordonnances | ordonnanceId | byCompteRendu, byPatientAndDate, byRendezVous, byStatut |
| `healthtrack-lignes-prescription` | Lignes de prescription | ordonnanceId (PK), ligneId (SK) | - |
| `healthtrack-medicaments` | Médicaments | medicamentId | byForme, bySubstanceActive |

## 💰 Coûts estimés (région eu-west-1)

| Service | Ressource | Coût mensuel (estimation) |
|---------|-----------|---------------------------|
| **Cognito** | 1 User Pool, 1 App Client | ~0-5 € |
| **DynamoDB** | 12 tables, PAY_PER_REQUEST | ~0-10 € |
| **Lambda** | 4 fonctions, 128 Mo, 1M requêtes | ~0-5 € |
| **API Gateway** | 4 APIs, 1M requêtes | ~3-10 € |
| **S3** | 1 bucket, 1 Go stockage | ~0,02 € |
| **CloudFront** | 1 distribution, 10 Go transfert | ~1-5 € |

**Total estimé** : **~5-35 €/mois** (selon utilisation)

## 🤝 Contribution

1. Lire **MISTRAL.md** pour connaître les tâches en cours
2. Créer une branche pour votre fonctionnalité
3. Committer vos modifications
4. Pousser vers la branche
5. Créer une Pull Request

## 📄 Licence

MIT

---

**Développé avec ❤️ pour les professionnels de santé.**
