# Déploiement AWS — HealthTrack

Le backend actuel est composé de quatre applications **Java 21 / Spring Boot**,
chacune exécutée dans une Lambda, derrière une **API Gateway HTTP API v2**.
Les données sont stockées dans DynamoDB et les logs d'exécution sont envoyés
à CloudWatch Logs par le rôle d'exécution Lambda.

L'authentification est le JWT maison de l'API Utilisateurs. Cognito n'est pas
utilisé par cette configuration.

## Prérequis

- Java 21 et Maven 3.8+
- Node.js 18+ et npm
- AWS CLI configuré (`aws configure`)
- `jq` et Bash (Linux, WSL ou Git Bash)
- Droits AWS pour Lambda, API Gateway v2, DynamoDB, IAM, S3 et CloudFront

Les scripts utilisent `AWS_REGION` si elle est définie, sinon `eu-west-1`.

## Déploiement complet

Depuis ce dossier, avec Bash :

```bash
./deploy-all.sh
```

Le script crée les tables DynamoDB, construit et déploie les quatre JARs Java,
configure les HTTP APIs, puis construit le frontend avec les URLs d'API et le
publie sur S3 et CloudFront.

Étapes individuelles :

```bash
./deploy-dynamodb.sh
./deploy-lambdas.sh
./deploy-apigateway.sh
./deploy-frontend.sh
```

`deploy-lambdas.sh` construit les artefacts avec Maven. Chaque fonction utilise
le runtime `java21` et le handler Java correspondant :

| Fonction Lambda | Handler |
|---|---|
| `healthtrack-api-utilisateurs` | `com.healthtrack.utilisateurs.LambdaHandler` |
| `healthtrack-api-rdv` | `com.healthtrack.rdv.LambdaHandler` |
| `healthtrack-api-dossiers` | `com.healthtrack.dossiers.LambdaHandler` |
| `healthtrack-api-ordonnances` | `com.healthtrack.ordonnances.LambdaHandler` |

API Gateway transmet les événements au format HTTP API v2, attendu par ces
handlers. Les routes sont protégées par le filtre JWT de chaque application ;
les routes d'inscription et de connexion restent accessibles sans token.

## Configuration et fichiers générés

Le déploiement génère à la racine du projet :

- `.env.jwt_secret` : secret partagé des JWT — ne pas partager ni committer.
- `.env.apigateway` : URLs des quatre APIs.
- `.env.frontend` : bucket S3, distribution CloudFront et URL publique.

Ces fichiers sont ignorés par Git. Le frontend est compilé avec les URLs des
APIs issues de `.env.apigateway`.

## Nettoyage

```bash
./cleanup.sh
```

**Attention :** cette commande supprime les ressources HealthTrack détectées
dans la région AWS sélectionnée, y compris les données DynamoDB. Vérifiez le
compte et la région avant de la lancer.

## Limites à connaître

- `deploy-dynamodb.sh` crée les tables initiales ; il ne migre pas le schéma
  d'une table déjà existante.
- Le bucket du frontend est public en lecture pour l'hébergement statique.
- Le déploiement nécessite que le compte AWS autorise la création de rôles IAM,
  politiques et ressources CloudFront.
