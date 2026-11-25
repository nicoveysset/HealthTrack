#!/bin/bash

# =============================================================================
# HealthTrack - Déploiement des Lambdas
# =============================================================================
# Crée 4 Lambdas (une par API) avec :
#   - Rôle IAM dédié
#   - Code Node.js de base
#   - Variables d'environnement
#   - Timeout et mémoire configurés
# =============================================================================

set -e

REGION="eu-west-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
RUNTIME="nodejs20.x"
TIMEOUT=15
MEMORY=256

echo "⚡ [Lambdas] Déploiement des 4 fonctions..."
echo ""

# =============================================================================
# Fonction utilitaire pour créer un rôle IAM
# =============================================================================
create_lambda_role() {
    local role_name=$1
    local policy_arn=$2
    
    echo "  Création du rôle IAM : $role_name..."
    
    # Créer le rôle
    TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
    )
    
    ROLE_ARN=$(aws iam create-role \
      --role-name "$role_name" \
      --assume-role-policy-document "$TRUST_POLICY" \
      --query "Role.Arn" \
      --output text \
      --region "$REGION")
    
    # Attacher la politique de base (CloudWatch Logs)
    aws iam attach-role-policy \
      --role-name "$role_name" \
      --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" \
      --region "$REGION"
    
    # Attacher la politique DynamoDB
    aws iam attach-role-policy \
      --role-name "$role_name" \
      --policy-arn "$policy_arn" \
      --region "$REGION"
    
    echo "  ✅ Rôle créé : $ROLE_ARN"
    echo "$ROLE_ARN"
}

# =============================================================================
# Créer la politique DynamoDB (accès à toutes les tables healthtrack)
# =============================================================================
echo "🔐 Création de la politique DynamoDB..."
DYNAMODB_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:DeleteItem",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:$REGION:$ACCOUNT_ID:table/healthtrack-*"
    }
  ]
}
EOF
)

DYNAMODB_POLICY_ARN=$(aws iam create-policy \
  --policy-name "HealthTrack-DynamoDB-Access" \
  --policy-document "$DYNAMODB_POLICY" \
  --query "Policy.Arn" \
  --output text \
  --region "$REGION")

echo "✅ Politique DynamoDB créée : $DYNAMODB_POLICY_ARN"
echo ""

# =============================================================================
# Cognito (OPTIONNEL — AWS Academy bloque souvent cognito-idp)
# En mode JWT maison (Option B du PLAN.md), on utilise JWT_SECRET en env var.
# =============================================================================
COGNITO_POLICY_ARN=""
USER_POOL_ID=""
if aws cognito-idp list-user-pools --max-results 1 --region "$REGION" >/dev/null 2>&1; then
    USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --region "$REGION" 2>/dev/null | jq -r '.UserPools[] | select(.Name == "HealthTrack-UserPool") | .Id // empty')
fi

if [ -n "$USER_POOL_ID" ]; then
    echo "📋 Cognito détecté : UserPool=$USER_POOL_ID (mode Cognito)"
    COGNITO_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["cognito-idp:GetUser", "cognito-idp:AdminGetUser"],
      "Resource": "arn:aws:cognito-idp:$REGION:$ACCOUNT_ID:userpool/*"
    }
  ]
}
EOF
)
    COGNITO_POLICY_ARN=$(aws iam create-policy \
      --policy-name "HealthTrack-Cognito-Access-$(date +%s)" \
      --policy-document "$COGNITO_POLICY" \
      --query "Policy.Arn" --output text --region "$REGION" 2>/dev/null || echo "")
else
    echo "ℹ️  Cognito non disponible (compte student) → mode JWT maison (JWT_SECRET en env var)"
fi
echo ""

# JWT_SECRET pour le mode maison
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -A n -t x1 | tr -d ' \n')}"
echo "$JWT_SECRET" > ../.env.jwt_secret
echo "🔑 JWT_SECRET sauvegardé dans ../.env.jwt_secret"
echo ""

# =============================================================================
# 1. Lambda Utilisateurs
# =============================================================================
echo "📋 [1/4] Déploiement Lambda Utilisateurs..."

# Créer le rôle
UTILISATEURS_ROLE_ARN=$(create_lambda_role "HealthTrack-Lambda-Utilisateurs-Role" "$DYNAMODB_POLICY_ARN")

# Attacher la politique Cognito
if [ -n "$COGNITO_POLICY_ARN" ]; then aws iam attach-role-policy \
  --role-name "HealthTrack-Lambda-Utilisateurs-Role" \
  --policy-arn "$COGNITO_POLICY_ARN" \
  --region "$REGION" 2>/dev/null || true; fi

# Créer la Lambda
UTILISATEURS_LAMBDA=$(aws lambda create-function \
  --function-name healthtrack-api-utilisateurs \
  --runtime "$RUNTIME" \
  --role "$UTILISATEURS_ROLE_ARN" \
  --handler "src/handlers/auth.handler" \
  --timeout "$TIMEOUT" \
  --memory-size "$MEMORY" \
  --environment "Variables={JWT_SECRET=$JWT_SECRET,DYNAMODB_REGION=$REGION${USER_POOL_ID:+,COGNITO_USER_POOL_ID=$USER_POOL_ID}}" \
  --region "$REGION")

UTILISATEURS_LAMBDA_ARN=$(echo "$UTILISATEURS_LAMBDA" | jq -r '.FunctionArn')
echo "✅ Lambda Utilisateurs créée : $UTILISATEURS_LAMBDA_ARN"

# Attendre que la Lambda soit active
aws lambda wait function-active \
  --function-name healthtrack-api-utilisateurs \
  --region "$REGION"

# =============================================================================
# 2. Lambda Disponibilités/RDV/Comptes Rendus
# =============================================================================
echo "📋 [2/4] Déploiement Lambda RDV..."

RDV_ROLE_ARN=$(create_lambda_role "HealthTrack-Lambda-RDV-Role" "$DYNAMODB_POLICY_ARN")

# Attacher la politique Cognito
if [ -n "$COGNITO_POLICY_ARN" ]; then aws iam attach-role-policy \
  --role-name "HealthTrack-Lambda-RDV-Role" \
  --policy-arn "$COGNITO_POLICY_ARN" \
  --region "$REGION" 2>/dev/null || true; fi

RDV_LAMBDA=$(aws lambda create-function \
  --function-name healthtrack-api-rdv \
  --runtime "$RUNTIME" \
  --role "$RDV_ROLE_ARN" \
  --handler "src/handlers/rdv.handler" \
  --timeout "$TIMEOUT" \
  --memory-size "$MEMORY" \
  --environment "Variables={JWT_SECRET=$JWT_SECRET,DYNAMODB_REGION=$REGION${USER_POOL_ID:+,COGNITO_USER_POOL_ID=$USER_POOL_ID}}" \
  --region "$REGION")

RDV_LAMBDA_ARN=$(echo "$RDV_LAMBDA" | jq -r '.FunctionArn')
echo "✅ Lambda RDV créée : $RDV_LAMBDA_ARN"

aws lambda wait function-active \
  --function-name healthtrack-api-rdv \
  --region "$REGION"

# =============================================================================
# 3. Lambda Dossiers Médicaux
# =============================================================================
echo "📋 [3/4] Déploiement Lambda Dossiers..."

DOSSIERS_ROLE_ARN=$(create_lambda_role "HealthTrack-Lambda-Dossiers-Role" "$DYNAMODB_POLICY_ARN")

# Attacher la politique Cognito
if [ -n "$COGNITO_POLICY_ARN" ]; then aws iam attach-role-policy \
  --role-name "HealthTrack-Lambda-Dossiers-Role" \
  --policy-arn "$COGNITO_POLICY_ARN" \
  --region "$REGION" 2>/dev/null || true; fi

DOSSIERS_LAMBDA=$(aws lambda create-function \
  --function-name healthtrack-api-dossiers \
  --runtime "$RUNTIME" \
  --role "$DOSSIERS_ROLE_ARN" \
  --handler "src/handlers/dossier.handler" \
  --timeout "$TIMEOUT" \
  --memory-size "$MEMORY" \
  --environment "Variables={JWT_SECRET=$JWT_SECRET,DYNAMODB_REGION=$REGION${USER_POOL_ID:+,COGNITO_USER_POOL_ID=$USER_POOL_ID}}" \
  --region "$REGION")

DOSSIERS_LAMBDA_ARN=$(echo "$DOSSIERS_LAMBDA" | jq -r '.FunctionArn')
echo "✅ Lambda Dossiers créée : $DOSSIERS_LAMBDA_ARN"

aws lambda wait function-active \
  --function-name healthtrack-api-dossiers \
  --region "$REGION"

# =============================================================================
# 4. Lambda Ordonnances
# =============================================================================
echo "📋 [4/4] Déploiement Lambda Ordonnances..."

ORDONNANCES_ROLE_ARN=$(create_lambda_role "HealthTrack-Lambda-Ordonnances-Role" "$DYNAMODB_POLICY_ARN")

# Attacher la politique Cognito
if [ -n "$COGNITO_POLICY_ARN" ]; then aws iam attach-role-policy \
  --role-name "HealthTrack-Lambda-Ordonnances-Role" \
  --policy-arn "$COGNITO_POLICY_ARN" \
  --region "$REGION" 2>/dev/null || true; fi

ORDONNANCES_LAMBDA=$(aws lambda create-function \
  --function-name healthtrack-api-ordonnances \
  --runtime "$RUNTIME" \
  --role "$ORDONNANCES_ROLE_ARN" \
  --handler "src/handlers/ordonnance.handler" \
  --timeout "$TIMEOUT" \
  --memory-size "$MEMORY" \
  --environment "Variables={JWT_SECRET=$JWT_SECRET,DYNAMODB_REGION=$REGION${USER_POOL_ID:+,COGNITO_USER_POOL_ID=$USER_POOL_ID}}" \
  --region "$REGION")

ORDONNANCES_LAMBDA_ARN=$(echo "$ORDONNANCES_LAMBDA" | jq -r '.FunctionArn')
echo "✅ Lambda Ordonnances créée : $ORDONNANCES_LAMBDA_ARN"

aws lambda wait function-active \
  --function-name healthtrack-api-ordonnances \
  --region "$REGION"

# =============================================================================
# Sauvegarder les ARNs dans un fichier
# =============================================================================
echo ""
echo "📋 Sauvegarde des ARNs..."
cat > ../.env.lambdas << EOF
# Lambda ARNs
UTILISATEURS_LAMBDA_ARN=$UTILISATEURS_LAMBDA_ARN
RDV_LAMBDA_ARN=$RDV_LAMBDA_ARN
DOSSIERS_LAMBDA_ARN=$DOSSIERS_LAMBDA_ARN
ORDONNANCES_LAMBDA_ARN=$ORDONNANCES_LAMBDA_ARN

# Rôles IAM
UTILISATEURS_ROLE_ARN=$UTILISATEURS_ROLE_ARN
RDV_ROLE_ARN=$RDV_ROLE_ARN
DOSSIERS_ROLE_ARN=$DOSSIERS_ROLE_ARN
ORDONNANCES_ROLE_ARN=$ORDONNANCES_ROLE_ARN

# Politiques
DYNAMODB_POLICY_ARN=$DYNAMODB_POLICY_ARN
COGNITO_POLICY_ARN=$COGNITO_POLICY_ARN
EOF

if ! grep -q "^\.env\.lambdas$" ../.gitignore; then
    echo ".env.lambdas" >> ../.gitignore
fi

echo "✅ ARNs sauvegardés dans ../.env.lambdas"

# =============================================================================
echo ""
echo "✅ Toutes les Lambdas ont été déployées !"
echo ""
echo "📋 Résumé :"
echo "   - healthtrack-api-utilisateurs : $UTILISATEURS_LAMBDA_ARN"
echo "   - healthtrack-api-rdv : $RDV_LAMBDA_ARN"
echo "   - healthtrack-api-dossiers : $DOSSIERS_LAMBDA_ARN"
echo "   - healthtrack-api-ordonnances : $ORDONNANCES_LAMBDA_ARN"
echo ""
echo "⚠️  Prochaine étape : Déployer les API Gateways avec ./deploy-apigateway.sh"
