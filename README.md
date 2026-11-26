# HealthTrack — Gestion de cabinet médical (API REST sur AWS)

HealthTrack digitalise un cabinet médical multi-praticiens : comptes patients et praticiens, disponibilités et
prise de rendez-vous, dossiers médicaux, comptes rendus de consultation et ordonnances.

Le backend est composé de **4 APIs REST indépendantes** (Java 21 / Spring Boot 3), chacune déployée dans
**sa propre Lambda AWS derrière API Gateway**, avec DynamoDB comme base de données. Un frontend React les consomme.

---

## Sommaire

1. [Architecture AWS](#1-architecture-aws)
2. [Fonctionnalités et règles métier](#2-fonctionnalités-et-règles-métier)
3. [Prérequis](#3-prérequis)
4. [Déploiement AWS pas à pas](#4-déploiement-aws-pas-à-pas)
5. [Variables d'environnement](#5-variables-denvironnement)
6. [Lancer le projet en local](#6-lancer-le-projet-en-local)
7. [Documentation Swagger](#7-documentation-swagger)
8. [Tests](#8-tests)
9. [Logs et alertes CloudWatch](#9-logs-et-alertes-cloudwatch)
10. [Structure du dépôt](#10-structure-du-dépôt)
11. [Choix techniques et limites](#11-choix-techniques-et-limites)

---

## 1. Architecture AWS

```
                 Navigateur
                     │  http (site statique)              Authorization: Bearer <JWT>
                     ▼                                              │
        ┌──────────────────────────┐                                │
        │  S3 — hébergement web    │  React (Vite) + config.js      │
        │  healthtrack-frontend-*  │  (URLs des 4 APIs)             │
        └──────────────────────────┘                                │
                                                                    ▼
   ┌──────────────────────┬───────────────────────┬───────────────────────┬──────────────────────┐
   │ API Gateway HTTP API │ API Gateway HTTP API  │ API Gateway HTTP API  │ API Gateway HTTP API │
   │ healthtrack-         │ healthtrack-rdv       │ healthtrack-dossiers  │ healthtrack-         │
   │ utilisateurs         │                       │                       │ ordonnances          │
   └──────────┬───────────┴───────────┬───────────┴───────────┬───────────┴──────────┬───────────┘
              ▼                       ▼                       ▼                      ▼
   ┌──────────────────────┐ ┌───────────────────────┐ ┌──────────────────────┐ ┌─────────────────────┐
   │ Lambda (Java 21)     │ │ Lambda (Java 21)      │ │ Lambda (Java 21)     │ │ Lambda (Java 21)    │
   │ api-utilisateurs     │ │ api-rdv               │ │ api-dossiers         │ │ api-ordonnances     │
   │ inscription, JWT,    │ │ disponibilités, RDV,  │ │ antécédents,         │ │ ordonnances,        │
   │ profils, praticiens  │ │ créneaux, comptes     │ │ allergies,           │ │ lignes, médicaments │
   │                      │ │ rendus                │ │ vaccinations         │ │                     │
   └──────────┬───────────┘ └───────────┬───────────┘ └──────────┬───────────┘ └──────────┬──────────┘
              └──────────────────┬──────┴────────────────────────┴────────────────────────┘
                                 ▼                                         │ logs JSON + métriques EMF
                    ┌─────────────────────────┐                ┌───────────▼───────────┐
                    │ DynamoDB — 12 tables    │                │ CloudWatch Logs,      │
                    │ healthtrack-*           │                │ métriques et alarmes  │
                    └─────────────────────────┘                └───────────────────────┘
```

| Service AWS | Rôle |
|---|---|
| **Lambda** (×4, runtime `java21`, 1024 Mo, 30 s) | Une Lambda par API. Spring Boot tourne dans la Lambda grâce à `aws-serverless-java-container` (handler `com.healthtrack.<api>.LambdaHandler`). |
| **API Gateway HTTP API** (×4) | Une API publique par Lambda, route `$default` (tout le routage est fait par Spring), CORS activé. |
| **DynamoDB** (12 tables, à la demande) | Persistance. Chaque API est propriétaire de ses tables (voir [docs/contrats.md](docs/contrats.md)). |
| **S3** | Hébergement statique du frontend + dépôt des JARs Lambda (trop gros pour un envoi direct de 50 Mo). |
| **CloudWatch** | Logs applicatifs structurés (JSON), métriques métier et alarmes. |
| **IAM** | Rôle d'exécution `LabRole` (AWS Academy) donnant accès à DynamoDB et CloudWatch. |

### Pourquoi ce découpage en 4 Lambdas ?

Chaque API correspond à un **domaine métier** du sujet (utilisateurs, agenda, dossier médical, prescription).
Les Lambdas sont déployées, mises à jour et dimensionnées indépendamment, et une panne ou un déploiement sur
l'une n'affecte pas les autres. Chaque domaine est propriétaire de ses tables.

### Comment les services communiquent-ils ?

- **Identité** : l'API Utilisateurs signe un JWT (HS256) avec la clé `JWT_SECRET`. Les 3 autres APIs vérifient
  ce token **localement** avec la même clé (variable d'environnement de chaque Lambda) : aucun appel réseau
  vers l'API Utilisateurs n'est nécessaire. Le token contient l'identifiant (`sub`), le `type` et le nom.
- **Données d'un autre domaine** : quand une règle métier a besoin des données d'un autre service, l'API les lit
  **directement dans la table DynamoDB du domaine concerné, en lecture seule**. Seul le service propriétaire écrit
  dans ses tables. Exemples :

  | API | Lit (lecture seule) | Pour |
  |---|---|---|
  | RDV | `healthtrack-utilisateurs` | refuser un RDV avec un praticien EN_CONGE / INACTIF, nom du patient |
  | Dossiers | `healthtrack-rendezvous` | `AccessDeniedException` si le praticien n'a jamais reçu le patient |
  | Dossiers | `healthtrack-ordonnances`, `-lignes-prescription`, `-medicaments` | `AllergyLinkedToActivePrescriptionException` |
  | Ordonnances | `healthtrack-rendezvous`, `healthtrack-comptes-rendus` | consultation TERMINE et compte rendu finalisé, bon praticien |
  | Ordonnances | `healthtrack-allergies` | `AllergyConflictException` |

  Ce choix évite des appels HTTP Lambda → API Gateway → Lambda (latence et démarrages à froid cumulés) ; la
  contrepartie est un couplage au schéma des tables lues, documenté dans [docs/contrats.md](docs/contrats.md).

---

## 2. Fonctionnalités et règles métier

| API | Fonctionnalités |
|---|---|
| **Utilisateurs** | inscription / connexion (patient ou praticien), consultation et modification de son profil, désignation du médecin traitant, passage d'un praticien en congé ou inactif, recherche paginée de praticiens (filtres spécialité, statut) |
| **Disponibilités & RDV** | disponibilités hebdomadaires, indisponibilités ponctuelles, créneaux libres sur une période, prise / confirmation / annulation de RDV, liste paginée filtrable (statut, dates), passage EN_COURS puis TERMINE, comptes rendus (brouillon puis finalisation) |
| **Dossiers médicaux** | consultation du dossier, groupe sanguin, ajout / modification / archivage d'antécédents, ajout / modification / suppression d'allergies, vaccinations, liste des allergies (utilisée à la prescription) |
| **Ordonnances** | création sur un RDV terminé, ajout / retrait de lignes, consultation des ordonnances d'un patient (paginée, filtre statut), liste des médicaments (filtres forme, recherche) |

Chaque règle du sujet est implémentée par une **exception nommée** (une classe par exception, package `exception`)
et renvoie un JSON homogène :

```json
{ "error": "SlotAlreadyTakenException", "message": "Le créneau du 2026-11-30 à 09:30 est déjà occupé",
  "statusCode": 409, "path": "/rendezvous", "timestamp": "2026-11-26T10:00:00Z" }
```

| Règle du sujet | Exception | HTTP |
|---|---|---|
| Désignation d'un non-généraliste comme médecin traitant | `InvalidSpecialityException` | 422 |
| Praticien INACTIF désigné comme médecin traitant | `PractitionerNotAvailableException` | 409 |
| Email déjà utilisé à l'inscription | `EmailAlreadyUsedException` | 409 |
| Praticien EN_CONGE ou INACTIF tente de créer / reçoit un rendez-vous | `PractitionerNotAvailableException` | 409 |
| Rendez-vous sur un créneau déjà occupé | `SlotAlreadyTakenException` | 409 |
| Rendez-vous dans le passé | `PastDateException` | 422 |
| Annulation moins de 2h avant | `CancellationTooLateException` | 409 |
| Chevauchement de créneaux pour un même praticien | `SlotOverlapException` | 409 |
| Rendez-vous sur une indisponibilité ponctuelle | `PractitionerUnavailableException` | 409 |
| Consultation du dossier par un praticien sans consultation antérieure | `AccessDeniedException` | 403 |
| Archivage d'un antécédent CHRONIQUE | `ChronicConditionCannotBeArchivedException` | 409 |
| Suppression d'une allergie liée à une ordonnance active | `AllergyLinkedToActivePrescriptionException` | 409 |
| Modification d'une allergie | log CloudWatch `ALLERGIE_UPDATED` avec l'identité du praticien | — |
| Ordonnance sur un rendez-vous non TERMINE | `ConsultationNotFinalizedException` | 409 |
| Prescription d'un médicament avec allergie connue | `AllergyConflictException` + log et métrique CloudWatch | 409 |
| Modification d'une ordonnance EXPIREE | `PrescriptionExpiredException` | 409 |
| Ligne de prescription de plus de 90 jours | alerte métier CloudWatch (métrique + alarme) | — |
| Ordonnance créée par un praticien n'ayant pas réalisé la consultation | `ForbiddenException` | 403 |

Codes HTTP : **400** requête mal formée (`ValidationException`), **401** token absent ou invalide, **403** droit
insuffisant, **404** ressource absente, **409** conflit avec l'état actuel (créneau pris, statut incompatible...),
**422** donnée bien formée mais refusée par une règle métier (date passée, spécialité).

Toutes les heures sont gérées dans le fuseau du cabinet, **Europe/Paris** (les Lambdas tournent en UTC).

---

## 3. Prérequis

| Outil | Version | Vérification |
|---|---|---|
| Java (JDK) | 21 | `java -version` |
| Maven | 3.8+ | `mvn -v` |
| Node.js / npm | 18+ | `node -v` |
| AWS CLI | v2 | `aws --version` |
| jq, curl, openssl | — | `jq --version` |
| Bash | Linux, macOS ou WSL | — |
| Docker *(local uniquement)* | — | `docker -v` |

Compte AWS : le projet est conçu pour **AWS Academy Learner Lab** (aucune création de rôle IAM, rôle `LabRole`,
région `us-east-1`). Sur un compte AWS classique, il suffit de fournir un rôle Lambda existant via `LAMBDA_ROLE_NAME`.

---

## 4. Déploiement AWS pas à pas

### Étape 0 — Démarrer le Learner Lab et configurer l'AWS CLI

1. Dans AWS Academy : **Modules → Learner Lab → Start Lab**, attendre le voyant vert.
2. **AWS Details → AWS CLI : Show**, copier le bloc dans `~/.aws/credentials` (à refaire à chaque session : les identifiants changent).
3. Puis :

```bash
aws configure set region us-east-1
aws configure set cli_pager ""        # évite que les scripts restent bloqués sur l'affichage paginé
aws sts get-caller-identity           # doit afficher ...assumed-role/voclabs/...
```

### Étape 1 — Récupérer le projet

```bash
git clone <url-du-depot> && cd HealthTrack
cd infrastructure
export AWS_REGION=us-east-1
```

### Étape 2 — Tables DynamoDB

```bash
./deploy-dynamodb.sh
```
Crée les 12 tables `healthtrack-*` (facturation à la demande) et leurs index secondaires.

### Étape 3 — Lambdas

```bash
./deploy-lambdas.sh
```
- compile les 4 APIs (`mvn clean package`) et produit un JAR `*-lambda.jar` par API ;
- dépose les JARs dans le bucket `healthtrack-lambda-artifacts-<compte>-<region>` ;
- crée (ou met à jour) les fonctions `healthtrack-api-utilisateurs`, `-rdv`, `-dossiers`, `-ordonnances` avec le rôle `LabRole` ;
- génère un `JWT_SECRET` aléatoire au premier lancement (conservé dans `.env.jwt_secret`, **à ne jamais committer**) et le pose en variable d'environnement des 4 Lambdas.

### Étape 4 — API Gateway

```bash
./deploy-apigateway.sh
```
Crée une HTTP API par Lambda (route `$default`, CORS) et écrit leurs URLs dans `.env.apigateway`.

### Étape 5 — Frontend

```bash
./deploy-frontend.sh
```
Build React, écrit `config.js` avec les URLs des APIs, publie le site sur un bucket S3 en hébergement web
et écrit son URL dans `.env.frontend` (`cat ../.env.frontend`). CloudFront est désactivé par défaut (interdit
dans le Learner Lab) ; `USE_CLOUDFRONT=true ./deploy-frontend.sh` l'active sur un compte classique.

### Étape 6 — Alarmes CloudWatch

```bash
./deploy-monitoring.sh
```
Crée les alarmes `HealthTrack-PrescriptionLongueDuree` et `HealthTrack-AllergyConflict`.

### Étape 7 — Données de démonstration

```bash
./seed-data.sh
```

| Compte (mot de passe `Demo1234!`) | Rôle |
|---|---|
| `dr.martin@healthtrack.fr` | Généraliste, ACTIF |
| `dr.bernard@healthtrack.fr` | Cardiologue |
| `dr.petit@healthtrack.fr` | Dermatologue |
| `dr.durand@healthtrack.fr` | Pédiatre |
| `dr.leroy@healthtrack.fr` | Généraliste **EN_CONGE** (démontre `PractitionerNotAvailableException`) |
| `alice.dupont@example.com`, `karim.benali@example.com` | Patients |

Les praticiens ont des disponibilités du lundi au vendredi (9h-12h, 14h-18h) ; 8 médicaments sont créés.

### En une commande

`./deploy-all.sh` enchaîne les étapes 2 à 6 (puis lancer `./seed-data.sh`).

### Vérifier le déploiement

```bash
source ../.env.apigateway
curl -s "$UTILISATEURS_API_URL/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"alice.dupont@example.com","password":"Demo1234!"}' | jq .user

# Test automatique de toutes les règles métier contre AWS (crée des comptes *@test.fr)
U=$UTILISATEURS_API_URL R=$RDV_API_URL D=$DOSSIERS_API_URL O=$ORDONNANCES_API_URL ./test-regles-metier.sh
```

Le premier appel peut prendre 10 à 20 s (démarrage à froid de Spring Boot dans la Lambda).

### Mettre à jour après une modification du code

| Modification | Commande |
|---|---|
| Code Java d'une API | `./deploy-lambdas.sh` (met à jour les 4 fonctions) |
| Frontend | `./deploy-frontend.sh` (réutilise le même bucket) |
| Contrat OpenAPI (`docs/*.yaml`) | `./deploy-lambdas.sh` (le contrat est embarqué dans le JAR) |

### Supprimer toutes les ressources

```bash
./cleanup.sh
```
⚠️ Supprime **toutes** les ressources HealthTrack de la région, données DynamoDB comprises.

---

## 5. Variables d'environnement

**Lambdas** (posées par `deploy-lambdas.sh`, jamais écrites dans le code) :

| Variable | Rôle |
|---|---|
| `JWT_SECRET` | Clé de signature HS256 des JWT, identique pour les 4 Lambdas, 32 caractères minimum. **Obligatoire** : aucune valeur par défaut dans le code. |
| `AWS_REGION` | Fournie automatiquement par Lambda (variable réservée), utilisée par le client DynamoDB. |

**Scripts de déploiement** (toutes optionnelles) :

| Variable | Défaut | Rôle |
|---|---|---|
| `AWS_REGION` | `us-east-1` | Région cible |
| `LAMBDA_ROLE_NAME` | `LabRole` | Rôle d'exécution des Lambdas |
| `JWT_SECRET` | généré puis lu dans `.env.jwt_secret` | Secret JWT à poser sur les Lambdas |
| `ARTIFACT_BUCKET` | `healthtrack-lambda-artifacts-<compte>-<region>` | Bucket des JARs |
| `FRONTEND_BUCKET` | lu dans `.env.frontend`, sinon nouveau nom | Bucket du site |
| `USE_CLOUDFRONT` | `false` | Distribution CloudFront devant le site |
| `SEED_PASSWORD` | `Demo1234!` | Mot de passe des comptes de démo |
| `ENV_FILE` | `.env.apigateway` | Fichier d'URLs utilisé par `seed-data.sh` |

**Exécution locale** :

| Variable | Exemple | Rôle |
|---|---|---|
| `JWT_SECRET` | `local-secret-de-32-caracteres-minimum!!` | Obligatoire |
| `DYNAMODB_ENDPOINT` | `http://localhost:8000` | Pointe vers DynamoDB Local au lieu d'AWS |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | `local` / `local` | Valeurs factices acceptées par DynamoDB Local |

Fichiers générés à la racine (ignorés par Git) : `.env.jwt_secret`, `.env.apigateway`, `.env.frontend`.

---

## 6. Lancer le projet en local

### Backend (4 APIs + DynamoDB Local)

```bash
# 1. DynamoDB Local
docker run -d --name ht-dynamo -p 8000:8000 amazon/dynamodb-local -jar DynamoDBLocal.jar -inMemory -sharedDb

# 2. Création des 12 tables dans DynamoDB Local
cd infrastructure
AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_REGION=us-east-1 \
AWS_ENDPOINT_URL_DYNAMODB=http://localhost:8000 ./deploy-dynamodb.sh
cd ..

# 3. Build puis lancement des 4 APIs (un terminal par API, ou en arrière-plan)
mvn clean package -DskipTests
export JWT_SECRET='local-secret-de-32-caracteres-minimum!!' DYNAMODB_ENDPOINT=http://localhost:8000 \
       AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_REGION=us-east-1
java -jar api-utilisateurs/target/healthtrack-utilisateurs-1.0.0-exec.jar             # port 8081
java -jar api-disponibilites-rdv/target/healthtrack-disponibilites-rdv-1.0.0-exec.jar # port 8082
java -jar api-dossiers-medicaux/target/healthtrack-dossiers-medicaux-1.0.0-exec.jar   # port 8083
java -jar api-ordonnances/target/healthtrack-ordonnances-1.0.0-exec.jar               # port 8084

# 4. Données de démonstration
cd infrastructure && ENV_FILE=env.local ./seed-data.sh
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

En local, `public/config.js` contient des chemins `/api-utilisateurs`, `/api-rdv`, ... que le proxy Vite
([vite.config.js](frontend/vite.config.js)) redirige vers `localhost:8081` à `8084`. Pour que le frontend local
utilise les APIs déployées sur AWS, remplacer ces chemins par les URLs de `.env.apigateway` dans `frontend/public/config.js`.

---

## 7. Documentation Swagger

Chaque API expose sa documentation **Swagger UI**, sur AWS comme en local :

| API | AWS | Local |
|---|---|---|
| Utilisateurs | `$UTILISATEURS_API_URL/swagger-ui.html` | http://localhost:8081/swagger-ui.html |
| Disponibilités & RDV | `$RDV_API_URL/swagger-ui.html` | http://localhost:8082/swagger-ui.html |
| Dossiers médicaux | `$DOSSIERS_API_URL/swagger-ui.html` | http://localhost:8083/swagger-ui.html |
| Ordonnances | `$ORDONNANCES_API_URL/swagger-ui.html` | http://localhost:8084/swagger-ui.html |

Swagger UI affiche les contrats OpenAPI de [docs/](docs/) (embarqués dans chaque JAR au build) : chaque route a
ses **exemples de requête et de réponse** et **tous ses cas d'erreur** avec le nom de l'exception.
Pour tester : `POST /auth/login` sur l'API Utilisateurs, copier le `token`, cliquer sur **Authorize** dans
n'importe quelle API. La spécification générée automatiquement depuis le code reste disponible sur `/v3/api-docs`.

---

## 8. Tests

| Type | Commande | Contenu |
|---|---|---|
| Unitaires (JUnit 5 + Mockito) | `mvn test` | 37 tests des règles métier des 4 services (horloge figée pour les règles de dates) |
| Bout en bout (bash + curl) | `infrastructure/test-regles-metier.sh` | 76 vérifications (code HTTP **et** nom d'exception) de toutes les règles du sujet, sur les APIs locales ou AWS |

```bash
# Contre les APIs locales (+ test d'ordonnance EXPIREE via DynamoDB Local)
DYNAMO_ENDPOINT=http://localhost:8000 AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local ./infrastructure/test-regles-metier.sh
```

---

## 9. Logs et alertes CloudWatch

- **Logs** : `CloudWatch → Groupes de journaux → /aws/lambda/healthtrack-api-<api>`. Chaque action métier écrit
  un log JSON (`RDV_CREATED`, `RDV_STATUT_CHANGED`, `ALLERGIE_UPDATED`, `ORDONNANCE_CREATED`, ...) ; chaque erreur
  métier est loggée en WARN (`BUSINESS_ERROR`) et chaque erreur inattendue en ERROR avec la pile d'appels.
- **Modification d'une allergie** : log `ALLERGIE_UPDATED` avec `praticienId`, `praticienNom` et les valeurs avant/après.
- **Alertes métier** : l'API Ordonnances publie les métriques `PrescriptionLongueDuree` et `AllergyConflict`
  (namespace `HealthTrack/Ordonnances`) au format *Embedded Metric Format* ; `deploy-monitoring.sh` crée une alarme sur chacune.

Exemple de requête **Logs Insights** :

```
fields @timestamp, @message
| filter @message like /ALLERGIE_UPDATED|ALLERGY_CONFLICT|ALERTE_PRESCRIPTION_LONGUE_DUREE/
| sort @timestamp desc
```

Ou en ligne de commande : `aws logs tail /aws/lambda/healthtrack-api-dossiers --since 1h --follow`.

---

## 10. Structure du dépôt

```
pom.xml                       parent Maven multi-modules (build Lambda : shade + repackage)
api-utilisateurs/             API 1 — inscription, JWT, profils, praticiens
api-disponibilites-rdv/       API 2 — disponibilités, créneaux, rendez-vous, comptes rendus
api-dossiers-medicaux/        API 3 — dossier, antécédents, allergies, vaccinations
api-ordonnances/              API 4 — ordonnances, lignes de prescription, médicaments
  └─ src/main/java/com/healthtrack/<api>/
       controller/            routes REST (aucune logique métier)
       service/               règles métier
       repository/            accès DynamoDB (Enhanced Client)
       model/ dto/            entités DynamoDB et objets d'échange
       exception/             une classe par exception + GlobalExceptionHandler
       config/                sécurité JWT, CORS, DynamoDB, fuseau horaire
       LambdaHandler.java     point d'entrée AWS Lambda
frontend/                     React 18 + Vite (voir frontend/README.md)
infrastructure/               scripts AWS CLI de déploiement, données de démo, tests (voir infrastructure/README.md)
docs/                         contrats OpenAPI (Swagger) et contrats techniques (tables, échanges)
```

---

## 11. Choix techniques et limites

- **Authentification — option B (JWT maison, jjwt)** : plus simple à faire fonctionner dans le Learner Lab et
  entièrement maîtrisée ; chaque Lambda vérifie le token avec le secret partagé (`JWT_SECRET`).
- **Spring Boot dans Lambda** : permet de garder une architecture en couches classique (controller / service /
  repository) et de lancer chaque API en local comme un serveur web. Contrepartie : démarrage à froid de quelques secondes.
- **DynamoDB** : sans serveur et facturé à la requête, adapté à des Lambdas. Les filtres et la pagination de faible
  volume sont faits côté service après une requête sur index (GSI).
- **REST** : ressources au pluriel, verbes HTTP standard, `201 + Location` à la création, `204` à la suppression,
  `PATCH` pour les modifications partielles (y compris le statut d'un rendez-vous ou l'archivage d'un antécédent).
  Seule exception assumée : `POST /rendezvous/{id}/compte-rendu/finalisation`, action métier irréversible.
- **Limites connues** : expiration des ordonnances évaluée à la lecture (pas de tâche planifiée) ; frontend servi
  en HTTP par S3 (CloudFront indisponible dans le Learner Lab) ; pas de réinitialisation de mot de passe.
