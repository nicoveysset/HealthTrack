# Infrastructure — scripts AWS CLI

Scripts Bash qui créent et mettent à jour toute l'infrastructure HealthTrack avec l'AWS CLI.
Ils sont adaptés à **AWS Academy Learner Lab** : région `us-east-1` par défaut, rôle Lambda existant `LabRole`
(aucune création IAM), pas de CloudFront. Le pas-à-pas complet est dans le [README principal](../README.md#4-déploiement-aws-pas-à-pas).

## Scripts

| Script | Rôle | Fichier produit |
|---|---|---|
| `deploy-dynamodb.sh` | Crée les 12 tables `healthtrack-*` et leurs GSI (ignore celles qui existent déjà) | — |
| `deploy-lambdas.sh` | `mvn clean package`, envoi des JARs sur S3, création / mise à jour des 4 Lambdas Java 21 (1024 Mo, 30 s) avec `JWT_SECRET` | `.env.jwt_secret` |
| `deploy-apigateway.sh` | Une HTTP API par Lambda (route `$default`, CORS) | `.env.apigateway` |
| `deploy-frontend.sh` | Build React, génération de `config.js` (URLs des APIs), publication S3 en hébergement web | `.env.frontend` |
| `deploy-monitoring.sh` | Alarmes CloudWatch sur les métriques métier `PrescriptionLongueDuree` et `AllergyConflict` | — |
| `deploy-all.sh` | Enchaîne DynamoDB → Lambdas → API Gateway → Frontend → Monitoring | — |
| `seed-data.sh` | Comptes de démonstration (5 praticiens, 2 patients), disponibilités, 8 médicaments — relançable sans risque | — |
| `test-regles-metier.sh` | 76 vérifications de bout en bout des règles métier (code HTTP + nom d'exception) | — |
| `cleanup.sh` | ⚠️ Supprime toutes les ressources HealthTrack de la région (tables et données comprises) | — |
| `deploy-cognito.sh` | Non utilisé (option A du sujet) : le projet utilise l'authentification JWT maison (option B) | — |
| `env.local` | URLs des APIs lancées en local, pour `ENV_FILE=env.local ./seed-data.sh` | — |

Les fichiers `.env.*` sont écrits à la racine du projet et ignorés par Git. `.env.jwt_secret` contient le
secret de signature des tokens : ne jamais le partager ni le committer.

## Ordre d'exécution

```bash
export AWS_REGION=us-east-1
./deploy-dynamodb.sh
./deploy-lambdas.sh
./deploy-apigateway.sh
./deploy-frontend.sh
./deploy-monitoring.sh
./seed-data.sh
```

Après une modification : `./deploy-lambdas.sh` (backend ou contrats OpenAPI) ou `./deploy-frontend.sh` (frontend).

## Variables d'environnement

| Variable | Défaut | Utilisée par |
|---|---|---|
| `AWS_REGION` | `us-east-1` | tous |
| `LAMBDA_ROLE_NAME` | `LabRole` | `deploy-lambdas.sh` |
| `JWT_SECRET` | lu dans `.env.jwt_secret`, sinon généré | `deploy-lambdas.sh` |
| `ARTIFACT_BUCKET` | `healthtrack-lambda-artifacts-<compte>-<region>` | `deploy-lambdas.sh` |
| `FRONTEND_BUCKET` | lu dans `.env.frontend`, sinon nouveau bucket | `deploy-frontend.sh` |
| `USE_CLOUDFRONT` | `false` | `deploy-frontend.sh` |
| `SEED_PASSWORD` | `Demo1234!` | `seed-data.sh` |
| `ENV_FILE` | `../.env.apigateway` | `seed-data.sh` |
| `U`, `R`, `D`, `O` | `http://localhost:8081` … `8084` | `test-regles-metier.sh` (URLs des 4 APIs) |
| `DYNAMO_ENDPOINT` | — | `test-regles-metier.sh` (test d'expiration, local uniquement) |

## Points d'attention (Learner Lab)

- Les identifiants AWS changent à chaque session : recopier le bloc « AWS CLI » de *AWS Details* dans `~/.aws/credentials`.
- `aws configure set cli_pager ""` évite que les scripts restent bloqués sur l'affichage paginé de l'AWS CLI.
- Les JARs (~48 Mo) dépassent la limite d'envoi direct de Lambda (50 Mo avec l'encodage) : ils passent par S3.
- `AWS_REGION` est une variable réservée de Lambda : elle n'est pas posée par les scripts, Lambda la fournit.
- `deploy-dynamodb.sh` ne migre pas une table existante : pour changer un schéma, supprimer la table d'abord.
- Le bucket du site est public en lecture (hébergement statique) ; les données restent derrière les APIs authentifiées.
