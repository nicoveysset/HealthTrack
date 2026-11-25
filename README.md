# HealthTrack — Java / Spring Boot / AWS Lambda + DynamoDB

4 microservices Spring Boot déployables sur **AWS Lambda + API Gateway**, avec **DynamoDB** comme base de données partagée.

## Architecture AWS

```
Frontend (S3 + CloudFront)
        │  HTTPS + JWT
        ▼
API Gateway (HTTP API v2) ×4 ──► Lambda Spring Boot ──► DynamoDB (12 tables partagées)
                                   │
                                   └──► CloudWatch Logs
```

| Service | Lambda handler | Table(s) DynamoDB |
|---------|---------------|-------------------|
| Utilisateurs | `com.healthtrack.utilisateurs.LambdaHandler` | `healthtrack-utilisateurs` |
| Dispo/RDV | `com.healthtrack.rdv.LambdaHandler` | `healthtrack-disponibilites`, `healthtrack-indisponibilites`, `healthtrack-rendezvous`, `healthtrack-comptes-rendus` |
| Dossiers | `com.healthtrack.dossiers.LambdaHandler` | `healthtrack-dossiers-medicaux`, `healthtrack-antecedents`, `healthtrack-allergies`, `healthtrack-vaccinations` |
| Ordonnances | `com.healthtrack.ordonnances.LambdaHandler` | `healthtrack-ordonnances`, `healthtrack-lignes-prescription`, `healthtrack-medicaments` |

## Prérequis

- Java 21+ (JDK complet), Maven 3.8+
- AWS CLI configuré (`aws configure`) avec les droits Lambda, API Gateway, DynamoDB, IAM

## Build

```bash
mvn clean package -DskipTests
```

Génère un fat JAR par module dans `api-*/target/*.jar`, prêt à être uploadé sur Lambda.

## Déploiement AWS (par service)

```bash
# 1. Créer la Lambda (exemple pour api-utilisateurs)
aws lambda create-function \
  --function-name healthtrack-api-utilisateurs \
  --runtime java21 \
  --handler com.healthtrack.utilisateurs.LambdaHandler \
  --role arn:aws:iam::<ACCOUNT>:role/healthtrack-lambda-role \
  --jar fileb://api-utilisateurs/target/healthtrack-utilisateurs-1.0.0.jar \
  --timeout 30 --memory-size 1024 \
  --environment "Variables={JWT_SECRET=<secret>,AWS_REGION=eu-west-1}"

# 2. Créer l'API Gateway HTTP API et l'intégrer à la Lambda
# 3. Répéter pour les 3 autres services
```

Les scripts dans `infrastructure/` (deploy-lambdas.sh, deploy-apigateway.sh, deploy-dynamodb.sh) peuvent être adaptés pour automatiser ces étapes.

## Variables d'environnement (Lambda)

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Clé secrète JWT (partagée entre les 4 Lambdas) |
| `AWS_REGION` | Région AWS (défaut: eu-west-1) |

## Développement local

```bash
# Lancer un service en local (sans DynamoDB réel — nécessite DynamoDB Local ou LocalStack)
mvn spring-boot:run -pl api-utilisateurs    # port 8081
mvn spring-boot:run -pl api-disponibilites-rdv  # port 8082
mvn spring-boot:run -pl api-dossiers-medicaux   # port 8083
mvn spring-boot:run -pl api-ordonnances         # port 8084
```

> En local, pointer vers **DynamoDB Local** : `aws dynamodb --endpoint-url http://localhost:8000 ...`

## Swagger (local uniquement)

http://localhost:808{1..4}/swagger-ui.html

## Structure

```
pom.xml                              # Parent multi-modules
api-utilisateurs/                    # Lambda 1 — Auth, profils, praticiens
api-disponibilites-rdv/              # Lambda 2 — Dispos, RDV, créneaux, CR
api-dossiers-medicaux/               # Lambda 3 — Dossiers, antécédents, allergies
api-ordonnances/                     # Lambda 4 — Ordonnances, médicaments
frontend/                            # React (S3 + CloudFront)
infrastructure/                      # Scripts AWS CLI
docs/                                # Contrats OpenAPI
```

## Stack technique

- Spring Boot 3.3.5 / Java 21
- aws-serverless-java-container (Spring Boot sur Lambda)
- AWS SDK v2 (DynamoDB Enhanced Client)
- JWT (jjwt 0.12.6) — Option B (secret partagé)
- Spring Security (stateless, filtre JWT)
- springdoc-openapi (Swagger UI en local)
