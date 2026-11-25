# Infrastructure — HealthTrack

Ce dossier contient les scripts de déploiement AWS CLI pour l'application **HealthTrack**.

## 📋 Prérequis

Avant d'exécuter les scripts, assurez-vous que :

1. **AWS CLI est installé et configuré** :
   ```bash
   aws --version
   aws configure
   ```

2. **jq est installé** (pour parser JSON) :
   ```bash
   # Ubuntu/Debian
   sudo apt-get install jq
   
   # macOS
   brew install jq
   
   # Windows (via Chocolatey)
   choco install jq
   ```

3. **Un compte AWS valide** avec les permissions suivantes :
   - Cognito (create user pool, app client)
   - DynamoDB (create tables, GSIs)
   - Lambda (create functions, IAM roles)
   - API Gateway (create REST APIs, authorizers)
   - S3 (create buckets, upload files)
   - CloudFront (create distributions)
   - IAM (create roles, policies)

4. **Node.js 20.x** (pour le développement local des Lambdas)

---

## 🚀 Déploiement

### Ordre d'exécution

Les scripts **doivent être exécutés dans cet ordre** :

```bash
# 1. Cognito (User Pool + App Client)
./deploy-cognito.sh

# 2. DynamoDB (12 tables + GSIs)
./deploy-dynamodb.sh

# 3. Lambdas (4 fonctions + IAM roles)
./deploy-lambdas.sh

# 4. API Gateway (4 REST APIs + authorizers)
./deploy-apigateway.sh

# 5. Frontend (S3 bucket + CloudFront)
./deploy-frontend.sh
```

**Ou tout en une fois :**
```bash
./deploy-all.sh
```

---

## 📁 Fichiers générés

Les scripts génèrent des fichiers `.env.*` contenant les IDs et ARNs des ressources créées :

- `.env.cognito` → User Pool ID, App Client ID/Secret
- `.env.lambdas` → ARNs des Lambdas et rôles IAM
- `.env.apigateway` → URLs et IDs des API Gateways
- `.env.frontend` → Nom du bucket S3, URL CloudFront

⚠️ **Ces fichiers contiennent des secrets et doivent être ajoutés au `.gitignore`** (c'est fait automatiquement par les scripts).

---

## 🔍 Scripts individuels

### 1. `deploy-cognito.sh`
Crée :
- **User Pool** : `HealthTrack-UserPool`
  - Authentification par email
  - Auto-vérification des emails
  - Attributs personnalisés : `type`, `custom:specialite`, `custom:rpps`
- **App Client** : `HealthTrack-AppClient`
  - Génère un client secret
  - Flux d'authentification : `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`
- **Domain** : `healthtrack-auth` (pour l'authentification via hosted UI)

**Durée** : ~10 secondes

---

### 2. `deploy-dynamodb.sh`
Crée **12 tables DynamoDB** avec leurs clés et GSIs :

| Table | Clé primaire | GSIs |
|-------|--------------|------|
| `healthtrack-utilisateurs` | `userId` | `byEmail`, `byMedecinTraitant` |
| `healthtrack-dossiers-medicaux` | `patientId` | - |
| `healthtrack-antecedents` | `antecedentId` | `byDossier`, `byDossierAndType`, `byStatut` |
| `healthtrack-allergies` | `allergieId` | `byPatient` |
| `healthtrack-vaccinations` | `vaccinationId` | `byDossier`, `byDossierAndNom` |
| `healthtrack-disponibilites` | `dispoId` | `byPraticien`, `byPraticienAndJour` |
| `healthtrack-indisponibilites` | `indispoId` | `byPraticien`, `byPraticienAndDate` |
| `healthtrack-rendezvous` | `rdvId` | `byPraticienAndDate`, `byPatientAndDate`, `byStatut` |
| `healthtrack-comptes-rendus` | `compteRenduId` | `byRdv`, `byPraticien`, `byPatient` |
| `healthtrack-ordonnances` | `ordonnanceId` | `byCompteRendu`, `byPatientAndDate`, `byRendezVous`, `byStatut` |
| `healthtrack-lignes-prescription` | `ordonnanceId` (PK), `ligneId` (SK) | - |
| `healthtrack-medicaments` | `medicamentId` | `byForme`, `bySubstanceActive` |

**Mode de facturation** : `PAY_PER_REQUEST` (pas de capacité provisionnée)

**Durée** : ~2-3 minutes (création de 12 tables)

---

### 3. `deploy-lambdas.sh`
Crée **4 fonctions Lambda** (Node.js 20.x) avec :

| Lambda | Nom | Handler | Rôle IAM |
|--------|-----|---------|----------|
| Utilisateurs | `healthtrack-api-utilisateurs` | `src/handlers/auth.handler` | `HealthTrack-Lambda-Utilisateurs-Role` |
| RDV | `healthtrack-api-rdv` | `src/handlers/rdv.handler` | `HealthTrack-Lambda-RDV-Role` |
| Dossiers | `healthtrack-api-dossiers` | `src/handlers/dossier.handler` | `HealthTrack-Lambda-Dossiers-Role` |
| Ordonnances | `healthtrack-api-ordonnances` | `src/handlers/ordonnance.handler` | `HealthTrack-Lambda-Ordonnances-Role` |

**Configurations :**
- Timeout : 15 secondes
- Mémoire : 256 Mo
- Runtime : Node.js 20.x

**Politiques IAM :**
- `AWSLambdaBasicExecutionRole` (pour CloudWatch Logs)
- `HealthTrack-DynamoDB-Access` (accès à toutes les tables `healthtrack-*`)
- `HealthTrack-Cognito-Access` (accès à Cognito User Pool)

**Durée** : ~1 minute

---

### 4. `deploy-apigateway.sh`
Crée **4 API Gateways REST** avec :

| API Gateway | Lambda associée | Authorizer |
|-------------|------------------|------------|
| `healthtrack-api-utilisateurs` | `healthtrack-api-utilisateurs` | Cognito User Pool |
| `healthtrack-api-rdv` | `healthtrack-api-rdv` | Cognito User Pool |
| `healthtrack-api-dossiers` | `healthtrack-api-dossiers` | Cognito User Pool |
| `healthtrack-api-ordonnances` | `healthtrack-api-ordonnances` | Cognito User Pool |

**Configuration :**
- **Authorizer** : Cognito User Pool (`HealthTrack-UserPool`)
- **Type d'intégration** : `AWS_PROXY` (la Lambda gère toute la logique)
- **Stage** : `prod`
- **Routes** :
  - `/` (ANY) → sans authentification (pour `/auth/register`, `/auth/login`)
  - `/{proxy+}` (ANY) → avec authentification Cognito

**Permissions :**
- Chaque API Gateway a la permission d'invoquer sa Lambda associée.

**Durée** : ~1-2 minutes

---

### 5. `deploy-frontend.sh`
Déploie le frontend sur **S3 + CloudFront** :

1. **Bucket S3** :
   - Nom : `healthtrack-frontend-<timestamp>`
   - Hébergement statique activé (`index.html` comme document racine)
   - Accès public en lecture

2. **CloudFront** :
   - Distribution avec :
     - Origin : `bucket.s3-website-<region>.amazonaws.com`
     - Protocol : redirige HTTP → HTTPS
     - Cache : TTL de 1 heure, compression activée
     - Prix : classe `PriceClass_100` (toutes les régions)
     - IPv6 : activé

3. **Upload du build** :
   - Si le dossier `../frontend/dist` existe, il est uploadé automatiquement.
   - Sinon, la commande d'upload est affichée.

**Durée** : ~5-15 minutes (CloudFront met du temps à se déployer)

---

## 🧹 Nettoyage

Pour supprimer toutes les ressources créées :

```bash
./cleanup.sh
```

⚠️ **Attention** : Ce script supprime **toutes** les ressources HealthTrack dans la région. Utilisez avec prudence.

---

## 💰 Coûts estimés (région eu-west-1)

| Service | Ressource | Coût mensuel (estimation) |
|---------|-----------|---------------------------|
| **Cognito** | 1 User Pool, 1 App Client | ~0-5 € (selon nombre d'utilisateurs) |
| **DynamoDB** | 12 tables, PAY_PER_REQUEST | ~0-10 € (selon nombre de requêtes) |
| **Lambda** | 4 fonctions, 128 Mo, 1M requêtes | ~0-5 € |
| **API Gateway** | 4 APIs, 1M requêtes | ~3-10 € |
| **S3** | 1 bucket, 1 Go stockage | ~0,02 € |
| **CloudFront** | 1 distribution, 10 Go transfert | ~1-5 € |

**Total estimé** : **~5-35 €/mois** (selon utilisation)

---

## 📚 Documentation utile

- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html)
- [DynamoDB Local (pour tests locaux)](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
- [LocalStack (alternative pour tests locaux)](https://localstack.cloud/)
- [Serverless Framework (alternative à AWS CLI)](https://www.serverless.com/)

---

## 🔧 Développement local

### DynamoDB Local

Pour tester les Lambdas en local sans AWS :

```bash
# Installer DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Créer les tables avec AWS CLI (endpoint local)
aws dynamodb create-table --endpoint-url http://localhost:8000 ...
```

### LocalStack

LocalStack émule tous les services AWS :

```bash
# Démarrer LocalStack
docker run -d -p 4566:4566 localstack/localstack

# Configurer AWS CLI pour LocalStack
aws --endpoint-url=http://localhost:4566 cognito-idp create-user-pool ...
```

---

## ⚠️ Problèmes courants

### 1. "User Pool not found"
**Solution** : Exécutez `./deploy-cognito.sh` avant les autres scripts.

### 2. "Lambda function not found"
**Solution** : Exécutez `./deploy-lambdas.sh` avant `./deploy-apigateway.sh`.

### 3. "Bucket already exists"
**Solution** : Le script génère un nom de bucket unique avec un timestamp.

### 4. "Distribution not yet deployed"
**Solution** : CloudFront peut mettre jusqu'à 15 minutes à se déployer. Attendez et réessayez.

### 5. "Access Denied" sur DynamoDB
**Solution** : Vérifiez que le rôle IAM de la Lambda a bien la politique `HealthTrack-DynamoDB-Access`.

### 6. "Invalid parameter" pour Cognito
**Solution** : Vérifiez que le User Pool et l'App Client existent et que leurs IDs sont corrects dans `.env.cognito`.

---

## 🎯 Conseils pour la soutenance

1. **Testez les scripts avant la soutenance** :
   - Exécutez `./deploy-all.sh` en local avec un compte AWS de test.
   - Vérifiez que toutes les ressources sont créées correctement.

2. **Préparez une démo** :
   - Montrez le déploiement avec `./deploy-all.sh`.
   - Testez une route simple (ex: `POST /auth/register`).
   - Montrez le frontend en accès via CloudFront.

3. **Expliquez l'architecture** :
   - 4 Lambdas indépendantes → séparation des responsabilités.
   - DynamoDB partagée → pas de latence HTTP entre services.
   - Cognito → authentification centralisée.
   - S3 + CloudFront → frontend statique rapide et sécurisé.

4. **Justifiez les choix** :
   - Pourquoi des Lambdas indépendantes ? → Évolutivité, isolation des pannes.
   - Pourquoi DynamoDB ? → Serverless, scalable, intégration native avec Lambda.
   - Pourquoi Cognito ? → Gestion centralisée des utilisateurs, sécurité.
   - Pourquoi CloudFront ? → CDN pour améliorer les performances.
