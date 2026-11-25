#!/bin/bash

# =============================================================================
# HealthTrack - Déploiement Cognito
# =============================================================================
# Crée :
#   - User Pool pour les utilisateurs (patients + praticiens)
#   - App Client pour le frontend
#   - Domain pour l'authentification (optionnel)
# =============================================================================

set -e

REGION="eu-west-1"
USER_POOL_NAME="HealthTrack-UserPool"
APP_CLIENT_NAME="HealthTrack-AppClient"
DOMAIN_NAME="healthtrack-auth"

echo "🔐 [Cognito] Création du User Pool..."

# Créer le User Pool
USER_POOL=$(aws cognito-idp create-user-pool \
  --pool-name "$USER_POOL_NAME" \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies "{
    \"PasswordPolicy\": {
      \"MinimumLength\": 8,
      \"RequireLowercase\": true,
      \"RequireNumbers\": true,
      \"RequireSymbols\": true,
      \"RequireUppercase\": true
    }
  }" \
  --schema "[
    {
      \"Name\": \"email\",
      \"AttributeDataType\": \"String\",
      \"Required\": true,
      \"Mutable\": true
    },
    {
      \"Name\": \"name\",
      \"AttributeDataType\": \"String\",
      \"Required\": false,
      \"Mutable\": true
    },
    {
      \"Name\": \"type\",
      \"AttributeDataType\": \"String\",
      \"Required\": true,
      \"Mutable\": false,
      \"DeveloperOnlyAttribute\": false
    },
    {
      \"Name\": \"custom:specialite\",
      \"AttributeDataType\": \"String\",
      \"Required\": false,
      \"Mutable\": true,
      \"DeveloperOnlyAttribute\": false
    },
    {
      \"Name\": \"custom:rpps\",
      \"AttributeDataType\": \"String\",
      \"Required\": false,
      \"Mutable\": true,
      \"DeveloperOnlyAttribute\": false
    }
  ]" \
  --region "$REGION")

USER_POOL_ID=$(echo "$USER_POOL" | jq -r '.UserPool.Id')
echo "✅ User Pool créé : $USER_POOL_ID"

# Créer l'App Client
APP_CLIENT=$(aws cognito-idp create-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-name "$APP_CLIENT_NAME" \
  --generate-secret \
  --explicit-auth-flows "ALLOW_USER_PASSWORD_AUTH,ALLOW_REFRESH_TOKEN_AUTH" \
  --prevent-user-existence-errors "ENABLED" \
  --region "$REGION")

APP_CLIENT_ID=$(echo "$APP_CLIENT" | jq -r '.UserPoolClient.ClientId')
APP_CLIENT_SECRET=$(echo "$APP_CLIENT" | jq -r '.UserPoolClient.ClientSecret')
echo "✅ App Client créé : $APP_CLIENT_ID"

# Créer le Domain (pour l'authentification via hosted UI)
DOMAIN=$(aws cognito-idp create-user-pool-domain \
  --domain "$DOMAIN_NAME" \
  --user-pool-id "$USER_POOL_ID" \
  --region "$REGION")

DOMAIN=$(echo "$DOMAIN" | jq -r '.Domain.Description')
echo "✅ Domain créé : $DOMAIN_NAME"

echo ""
echo "📋 [Cognito] Résumé :"
echo "   User Pool ID : $USER_POOL_ID"
echo "   App Client ID : $APP_CLIENT_ID"
echo "   App Client Secret : $APP_CLIENT_SECRET (À STOCKER EN SECRET !)"
echo "   Domain : https://$DOMAIN_NAME.auth.$REGION.amazoncognito.com"
echo ""

# Sauvegarder les IDs dans un fichier .env (à ne pas commiter !)
cat > ../.env.cognito << EOF
# Cognito Configuration
COGNITO_USER_POOL_ID=$USER_POOL_ID
COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID
COGNITO_APP_CLIENT_SECRET=$APP_CLIENT_SECRET
COGNITO_REGION=$REGION
COGNITO_DOMAIN=$DOMAIN_NAME
EOF

echo "✅ Configuration sauvegardée dans ../.env.cognito (À AJOUTER AU .gitignore !)"

# Ajouter .env.cognito au .gitignore
if [ ! -f ../.gitignore ]; then
    touch ../.gitignore
fi
if ! grep -q "^\.env\.cognito$" ../.gitignore; then
    echo ".env.cognito" >> ../.gitignore
    echo "✅ .env.cognito ajouté au .gitignore"
fi

echo ""
echo "✅ Déploiement Cognito terminé !"
