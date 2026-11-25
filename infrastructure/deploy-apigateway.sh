#!/bin/bash

# =============================================================================
# HealthTrack - Déploiement API Gateway
# =============================================================================
# Crée 4 API Gateways (une par Lambda) avec :
#   - Authorizer Cognito
#   - Routes principales
#   - Déploiement en stage 'prod'
# =============================================================================

set -e

REGION="eu-west-1"

echo "🌐 [API Gateway] Déploiement des 4 API Gateways..."
echo ""

# =============================================================================
# Récupérer les ARNs des Lambdas
# =============================================================================
UTILISATEURS_LAMBDA_ARN=$(aws lambda get-function --function-name healthtrack-api-utilisateurs --region "$REGION" --query "Configuration.FunctionArn" --output text 2>/dev/null || echo "")
RDV_LAMBDA_ARN=$(aws lambda get-function --function-name healthtrack-api-rdv --region "$REGION" --query "Configuration.FunctionArn" --output text 2>/dev/null || echo "")
DOSSIERS_LAMBDA_ARN=$(aws lambda get-function --function-name healthtrack-api-dossiers --region "$REGION" --query "Configuration.FunctionArn" --output text 2>/dev/null || echo "")
ORDONNANCES_LAMBDA_ARN=$(aws lambda get-function --function-name healthtrack-api-ordonnances --region "$REGION" --query "Configuration.FunctionArn" --output text 2>/dev/null || echo "")

if [ -z "$UTILISATEURS_LAMBDA_ARN" ] || [ -z "$RDV_LAMBDA_ARN" ] || [ -z "$DOSSIERS_LAMBDA_ARN" ] || [ -z "$ORDONNANCES_LAMBDA_ARN" ]; then
    echo "❌ Une ou plusieurs Lambdas introuvables. Exécutez d'abord deploy-lambdas.sh"
    exit 1
fi

echo "📋 ARNs des Lambdas :"
echo "   Utilisateurs: $UTILISATEURS_LAMBDA_ARN"
echo "   RDV: $RDV_LAMBDA_ARN"
echo "   Dossiers: $DOSSIERS_LAMBDA_ARN"
echo "   Ordonnances: $ORDONNANCES_LAMBDA_ARN"
echo ""

# =============================================================================
# Cognito (optionnel — AWS Academy bloque souvent cognito-idp:CreateUserPool)
# En mode JWT maison (Option B du PLAN.md), l'authentification est vérifiée
# par la Lambda elle-même via jwt.verify(token, JWT_SECRET).
# L'authorizer API Gateway est donc "NONE" sur toutes les routes.
# =============================================================================
USER_POOL_ID=""
APP_CLIENT_ID=""
if aws cognito-idp list-user-pools --max-results 10 --region "$REGION" >/dev/null 2>&1; then
    USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --region "$REGION" 2>/dev/null | jq -r '.UserPools[] | select(.Name == "HealthTrack-UserPool") | .Id // empty')
fi

if [ -n "$USER_POOL_ID" ]; then
    APP_CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --max-results 10 --region "$REGION" 2>/dev/null | jq -r '.UserPoolClients[] | select(.ClientName == "HealthTrack-AppClient") | .ClientId // empty')
    echo "📋 Cognito détecté : UserPool=$USER_POOL_ID, AppClient=$APP_CLIENT_ID"
else
    echo "ℹ️  Cognito non disponible (compte student ?) → mode JWT maison (vérification dans la Lambda)"
fi
echo ""

# =============================================================================
# Fonction pour créer une API Gateway (auth NONE — la Lambda vérifie le JWT)
# =============================================================================
create_api_gateway() {
    local api_name=$1
    local lambda_arn=$2
    local api_description=$3
    
    echo "  Création de l'API Gateway : $api_name..."
    
    # Créer l'API
    API_ID=$(aws apigateway create-rest-api \
      --name "$api_name" \
      --description "$api_description" \
      --region "$REGION" | \
      jq -r '.id')
    
    echo "  ✅ API créée : $API_ID"
    
    # Donner les permissions à API Gateway pour invoquer la Lambda
    aws lambda add-permission \
      --function-name "$lambda_arn" \
      --statement-id "apigateway-invoke-$api_name" \
      --action "lambda:InvokeFunction" \
      --principal "apigateway.amazonaws.com" \
      --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*" \
      --region "$REGION"
    
    echo "  ✅ Permission Lambda ajoutée"
    
    # Créer la ressource racine
    ROOT_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id "$API_ID" --region "$REGION" | jq -r '.items[] | select(.path == "/") | .id')
    
    # Créer la ressource proxy {proxy+} pour toutes les sous-routes
    PROXY_RESOURCE_ID=$(aws apigateway create-resource \
      --rest-api-id "$API_ID" \
      --parent-id "$ROOT_RESOURCE_ID" \
      --path-part "{proxy+}" \
      --region "$REGION" | \
      jq -r '.id')
    
    # Méthode ANY sur le proxy — auth NONE (la Lambda vérifie le JWT elle-même)
    aws apigateway put-method \
      --rest-api-id "$API_ID" \
      --resource-id "$PROXY_RESOURCE_ID" \
      --http-method "ANY" \
      --authorization-type "NONE" \
      --region "$REGION"
    
    # Intégration Lambda proxy
    aws apigateway put-integration \
      --rest-api-id "$API_ID" \
      --resource-id "$PROXY_RESOURCE_ID" \
      --http-method "ANY" \
      --type "AWS_PROXY" \
      --integration-http-method "POST" \
      --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$lambda_arn/invocations" \
      --region "$REGION"
    
    # Méthode ANY sur la racine (pour /, /health, etc.)
    aws apigateway put-method \
      --rest-api-id "$API_ID" \
      --resource-id "$ROOT_RESOURCE_ID" \
      --http-method "ANY" \
      --authorization-type "NONE" \
      --region "$REGION"
    
    aws apigateway put-integration \
      --rest-api-id "$API_ID" \
      --resource-id "$ROOT_RESOURCE_ID" \
      --http-method "ANY" \
      --type "AWS_PROXY" \
      --integration-http-method "POST" \
      --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$lambda_arn/invocations" \
      --region "$REGION"
    
    # CORS sur le proxy
    aws apigateway put-method-response \
      --rest-api-id "$API_ID" --resource-id "$PROXY_RESOURCE_ID" --http-method "ANY" \
      --status-code "200" \
      --response-parameters "method.response.header.Access-Control-Allow-Origin=false" \
      --region "$REGION" 2>/dev/null || true
    aws apigateway put-integration-response \
      --rest-api-id "$API_ID" --resource-id "$PROXY_RESOURCE_ID" --http-method "ANY" \
      --status-code "200" \
      --response-parameters "method.response.header.Access-Control-Allow-Origin='*'" \
      --region "$REGION" 2>/dev/null || true
    
    # Déployer l'API en stage 'prod'
    aws apigateway create-deployment \
      --rest-api-id "$API_ID" \
      --stage-name "prod" \
      --region "$REGION" > /dev/null
    
    API_URL="https://$API_ID.execute-api.$REGION.amazonaws.com/prod"
    echo "  ✅ API déployée : $API_URL"
    
    echo "$API_ID|$API_URL" 
}

# =============================================================================
# Créer les 4 API Gateways
# =============================================================================

# 1. API Utilisateurs
echo "📋 [1/4] Création API Gateway Utilisateurs..."
UTILISATEURS_API_INFO=$(create_api_gateway "healthtrack-api-utilisateurs" "$UTILISATEURS_LAMBDA_ARN" "API pour la gestion des utilisateurs (inscription, connexion, profils)")
UTILISATEURS_API_ID=$(echo "$UTILISATEURS_API_INFO" | cut -d'|' -f1)
UTILISATEURS_API_URL=$(echo "$UTILISATEURS_API_INFO" | cut -d'|' -f2)
echo ""

# 2. API RDV/Disponibilités
echo "📋 [2/4] Création API Gateway RDV..."
RDV_API_INFO=$(create_api_gateway "healthtrack-api-rdv" "$RDV_LAMBDA_ARN" "API pour les disponibilités, rendez-vous et comptes rendus")
RDV_API_ID=$(echo "$RDV_API_INFO" | cut -d'|' -f1)
RDV_API_URL=$(echo "$RDV_API_INFO" | cut -d'|' -f2)
echo ""

# 3. API Dossiers Médicaux
echo "📋 [3/4] Création API Gateway Dossiers..."
DOSSIERS_API_INFO=$(create_api_gateway "healthtrack-api-dossiers" "$DOSSIERS_LAMBDA_ARN" "API pour la gestion des dossiers médicaux (antécédents, allergies, vaccinations)")
DOSSIERS_API_ID=$(echo "$DOSSIERS_API_INFO" | cut -d'|' -f1)
DOSSIERS_API_URL=$(echo "$DOSSIERS_API_INFO" | cut -d'|' -f2)
echo ""

# 4. API Ordonnances
echo "📋 [4/4] Création API Gateway Ordonnances..."
ORDONNANCES_API_INFO=$(create_api_gateway "healthtrack-api-ordonnances" "$ORDONNANCES_LAMBDA_ARN" "API pour la gestion des ordonnances et médicaments")
ORDONNANCES_API_ID=$(echo "$ORDONNANCES_API_INFO" | cut -d'|' -f1)
ORDONNANCES_API_URL=$(echo "$ORDONNANCES_API_INFO" | cut -d'|' -f2)
echo ""

# =============================================================================
# Sauvegarder les URLs dans un fichier
# =============================================================================
echo "📋 Sauvegarde des URLs..."
cat > ../.env.apigateway << EOF
# API Gateway URLs
UTILISATEURS_API_URL=$UTILISATEURS_API_URL
RDV_API_URL=$RDV_API_URL
DOSSIERS_API_URL=$DOSSIERS_API_URL
ORDONNANCES_API_URL=$ORDONNANCES_API_URL

# API Gateway IDs
UTILISATEURS_API_ID=$UTILISATEURS_API_ID
RDV_API_ID=$RDV_API_ID
DOSSIERS_API_ID=$DOSSIERS_API_ID
ORDONNANCES_API_ID=$ORDONNANCES_API_ID

# Cognito (optionnel — vide si non disponible)
COGNITO_USER_POOL_ID=${USER_POOL_ID:-}
COGNITO_APP_CLIENT_ID=${APP_CLIENT_ID:-}

# Mode d'authentification : "jwt" (maison, par défaut) ou "cognito"
AUTH_MODE=$([ -n "$USER_POOL_ID" ] && echo "cognito" || echo "jwt")
EOF

if ! grep -q "^\.env\.apigateway$" ../.gitignore; then
    echo ".env.apigateway" >> ../.gitignore
fi

echo "✅ URLs sauvegardées dans ../.env.apigateway"

# =============================================================================
echo ""
echo "✅ Toutes les API Gateways ont été déployées !"
echo ""
echo "📋 Résumé :"
echo "   Utilisateurs : $UTILISATEURS_API_URL"
echo "   RDV : $RDV_API_URL"
echo "   Dossiers : $DOSSIERS_API_URL"
echo "   Ordonnances : $ORDONNANCES_API_URL"
echo ""
echo "⚠️  Prochaine étape : Déployer le frontend avec ./deploy-frontend.sh"
