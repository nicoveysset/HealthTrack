# API Utilisateurs — HealthTrack

API pour la gestion des utilisateurs (patients et praticiens) dans l'application HealthTrack.

## 📋 Fonctionnalités

### Routes

| Méthode | Route | Description | Authentification | Rôle |
|---------|-------|-------------|------------------|------|
| POST | `/auth/register` | Inscription d'un nouvel utilisateur | ❌ | - |
| POST | `/auth/login` | Connexion d'un utilisateur | ❌ | - |
| GET | `/utilisateurs/me` | Récupérer son profil | ✅ | Tout |
| PATCH | `/utilisateurs/me` | Mettre à jour son profil | ✅ | Tout |
| PUT | `/patients/me/medecin-traitant` | Désigner son médecin traitant | ✅ | Patient |
| PATCH | `/praticiens/me/statut` | Changer son statut | ✅ | Praticien |
| GET | `/praticiens` | Lister les praticiens (paginé/filtré) | ✅ | Tout |

### Filtrage et pagination

La route `GET /praticiens` accepte les paramètres suivants :

| Paramètre | Type | Description | Valeurs possibles |
|-----------|------|-------------|-------------------|
| `specialite` | string | Filtrer par spécialité | - |
| `statut` | string | Filtrer par statut | `ACTIF`, `EN_CONGE`, `INACTIF` |
| `page` | number | Numéro de page | ≥ 1 |
| `limit` | number | Nombre d'éléments par page | 1-100 |

### Exemple de requête

```bash
# Inscription d'un patient
curl -X POST https://<api-gateway-url>/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient@example.com",
    "password": "securePassword123!",
    "type": "PATIENT",
    "firstName": "Jean",
    "lastName": "Dupont",
    "dateNaissance": "1990-01-01",
    "nss": "123456789012345"
  }'

# Inscription d'un praticien
curl -X POST https://<api-gateway-url>/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "docteur@example.com",
    "password": "securePassword123!",
    "type": "PRATICIEN",
    "firstName": "Marie",
    "lastName": "Martin",
    "specialite": "Médecine générale",
    "rpps": "1234567890"
  }'

# Connexion
curl -X POST https://<api-gateway-url>/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient@example.com",
    "password": "securePassword123!"
  }'

# Récupérer son profil
curl -X GET https://<api-gateway-url>/utilisateurs/me \
  -H "Authorization: Bearer <jwt-token>"

# Désigner son médecin traitant
curl -X PUT https://<api-gateway-url>/patients/me/medecin-traitant \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "medecinTraitantId": "docteur-id-123"
  }'

# Lister les praticiens
curl -X GET https://<api-gateway-url>/praticiens?specialite=Médecine%20générale&statut=ACTIF&page=1&limit=10 \
  -H "Authorization: Bearer <jwt-token>"
```

## 🛠 Configuration

### Variables d'environnement

| Variable | Description | Obligatoire | Défaut |
|----------|-------------|-------------|--------|
| `DYNAMODB_REGION` | Région AWS pour DynamoDB | ✅ | `eu-west-1` |
| `JWT_SECRET` | Clé secrète pour la signature des JWT | ✅ | - |
| `COGNITO_USER_POOL_ID` | ID du User Pool Cognito | ❌ | - |

### DynamoDB

**Table** : `healthtrack-utilisateurs`

**Clés** :
- Clé primaire : `userId` (String)
- GSI `byEmail` : `email` (String)
- GSI `byMedecinTraitant` : `medecinTraitantId` (String) + `type` (String)

**Attributs** :
| Attribut | Type | Description | Requis |
|----------|------|-------------|--------|
| `userId` | String | Identifiant unique | ✅ |
| `email` | String | Adresse email | ✅ |
| `passwordHash` | String | Hash du mot de passe (BCrypt) | ✅ |
| `type` | String | Type d'utilisateur (`PRATICIEN` ou `PATIENT`) | ✅ |
| `name` | String | Nom complet | ❌ |
| `firstName` | String | Prénom | ❌ |
| `lastName` | String | Nom | ❌ |
| `createdAt` | String | Date de création (ISO) | ✅ |
| `updatedAt` | String | Date de mise à jour (ISO) | ✅ |
| `specialite` | String | Spécialité (praticien uniquement) | ❌ |
| `rpps` | String | RPPS (praticien uniquement) | ❌ |
| `statut` | String | Statut (`ACTIF`, `EN_CONGE`, `INACTIF`) | ❌ |
| `dateNaissance` | String | Date de naissance (ISO) | ❌ |
| `nss` | String | Numéro de sécurité sociale | ❌ |
| `medecinTraitantId` | String | ID du médecin traitant | ❌ |

## 🚀 Déploiement

### Avec AWS CLI

```bash
# Créer la fonction Lambda
zip -r function.zip .

aws lambda create-function \
  --function-name healthtrack-api-utilisateurs \
  --runtime nodejs20.x \
  --role arn:aws:iam::123456789012:role/HealthTrack-Lambda-Utilisateurs-Role \
  --handler src/handlers/auth.handler \
  --zip-file fileb://function.zip \
  --environment Variables="{DYNAMODB_REGION=eu-west-1,JWT_SECRET=my-secret-key}" \
  --timeout 15 \
  --memory-size 256
```

### Avec Serverless Framework

Créer un fichier `serverless.yml` :

```yaml
service: healthtrack-api-utilisateurs

provider:
  name: aws
  runtime: nodejs20.x
  region: eu-west-1
  environment:
    DYNAMODB_REGION: eu-west-1
    JWT_SECRET: ${env:JWT_SECRET}

functions:
  api:
    handler: src/handlers/auth.handler
    events:
      - http:
          path: /auth/register
          method: post
      - http:
          path: /auth/login
          method: post
      - http:
          path: /utilisateurs/me
          method: get
          authorizer: none
      - http:
          path: /utilisateurs/me
          method: patch
          authorizer: none
      - http:
          path: /patients/me/medecin-traitant
          method: put
          authorizer: none
      - http:
          path: /praticiens/me/statut
          method: patch
          authorizer: none
      - http:
          path: /praticiens
          method: get
          authorizer: none
```

## ✅ Tests

### Tests unitaires

```bash
npm test
```

### Tests manuels

Utiliser **Postman** ou **cURL** pour tester les endpoints.

## 📝 Exceptions

| Exception | Code HTTP | Description |
|-----------|-----------|-------------|
| `ValidationError` | 400 | Données de requête invalides |
| `EmailAlreadyUsedException` | 409 | Email déjà utilisé |
| `InvalidCredentials` | 401 | Email ou mot de passe incorrect |
| `Unauthorized` | 401 | Non authentifié |
| `Forbidden` | 403 | Non autorisé (rôle incorrect) |
| `NotFound` | 404 | Ressource non trouvée |
| `PractitionerNotAvailableException` | 409 | Le praticien n'est pas disponible |

## 📂 Structure

```
api-utilisateurs/
├── src/
│   ├── handlers/
│   │   └── auth.js          # Handler principal
│   ├── models/
│   │   └── user.js          # Modèle Utilisateur
│   └── services/            # (À créer)
│       └── userService.js   # Service Utilisateur
├── test/                    # (À créer)
│   └── auth.test.js         # Tests unitaires
├── package.json
└── README.md
```

## 🔗 Dépendances

- `@aws-sdk/client-dynamodb` : Client DynamoDB
- `@aws-sdk/lib-dynamodb` : Utilitaires DynamoDB
- `bcryptjs` : Hashage des mots de passe
- `jsonwebtoken` : Génération des JWT
- `uuid` : Génération des IDs
