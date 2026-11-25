#!/bin/bash

# =============================================================================
# HealthTrack - Déploiement Frontend
# =============================================================================
# Déploie le frontend sur :
#   - S3 bucket (hébergement statique)
#   - CloudFront (CDN + HTTPS)
# =============================================================================

set -e

REGION="eu-west-1"
BUCKET_NAME="healthtrack-frontend-$(date +%s)"

echo "🎨 [Frontend] Déploiement sur S3 + CloudFront..."
echo ""

# =============================================================================
# Étape 1 : Créer le bucket S3
# =============================================================================
echo "📦 [1/4] Création du bucket S3..."

# Vérifier que le nom de bucket est unique
while true; do
    if ! aws s3api head-bucket --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
        break
    fi
    BUCKET_NAME="healthtrack-frontend-$(date +%s%N | tail -c 10)"
done

aws s3api create-bucket \
  --bucket "$BUCKET_NAME" \
  --region "$REGION" \
  --object-ownership "BucketOwnerEnforced"

echo "✅ Bucket créé : $BUCKET_NAME"
echo ""

# =============================================================================
# Étape 2 : Configurer l'hébergement statique
# =============================================================================
echo "📄 [2/4] Configuration de l'hébergement statique..."

aws s3 website \
  --bucket "$BUCKET_NAME" \
  --index-document "index.html" \
  --error-document "index.html"

echo "✅ Hébergement statique activé"
echo ""

# =============================================================================
# Étape 3 : Configurer les permissions du bucket
# =============================================================================
echo "🔐 [3/4] Configuration des permissions..."

# Politique pour permettre l'accès public en lecture
BUCKET_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF
)

aws s3api put-bucket-policy \
  --bucket "$BUCKET_NAME" \
  --policy "$BUCKET_POLICY"

# Désactiver le blocage de l'accès public
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration "{
    \"BlockPublicAcls\": false,
    \"IgnorePublicAcls\": false,
    \"BlockPublicPolicy\": false,
    \"RestrictPublicBuckets\": false
  }"

echo "✅ Permissions configurées"
echo ""

# =============================================================================
# Étape 4 : Créer la distribution CloudFront
# =============================================================================
echo "🌍 [4/4] Création de la distribution CloudFront..."

# Récupérer l'ID du compte AWS
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)

# Créer la distribution CloudFront
DISTRIBUTION=$(aws cloudfront create-distribution \
  --origin-domain-name "$BUCKET_NAME.s3-website-$REGION.amazonaws.com" \
  --default-root-object "index.html" \
  --distribution-config "{
    \"CallerReference\": \"$(date +%s%N)\",
    \"Comment\": \"HealthTrack Frontend\",
    \"DefaultCacheBehavior\": {
      \"TargetOriginId\": \"S3-$BUCKET_NAME\",
      \"ForwardedValues\": {
        \"QueryString\": false,
        \"Cookies\": {\"Forward\": \"none\"}
      },
      \"TrustedSigners\": {
        \"Enabled\": false,
        \"Quantity\": 0
      },
      \"ViewerProtocolPolicy\": \"redirect-to-https\",
      \"MinTTL\": 3600,
      \"AllowedMethods\": {
        \"CachedMethods\": {\"Quantity\": 2, \"Items\": [\"GET\", \"HEAD\"]},
        \"AllowedMethods\": {\"Quantity\": 7, \"Items\": [\"GET\", \"HEAD\", \"POST\", \"PUT\", \"PATCH\", \"DELETE\", \"OPTIONS\"]}
      },
      \"SmoothStreaming\": false,
      \"DefaultTTL\": 86400,
      \"MaxTTL\": 31536000,
      \"Compress\": true
    },
    \"Origins\": {
      \"Quantity\": 1,
      \"Items\": [
        {
          \"Id\": \"S3-$BUCKET_NAME\",
          \"DomainName\": \"$BUCKET_NAME.s3-website-$REGION.amazonaws.com\",
          \"CustomOriginConfig\": {
            \"HTTPPort\": 80,
            \"HTTPSPort\": 443,
            \"OriginProtocolPolicy\": \"http-only\"
          }
        }
      ]
    },
    \"Enabled\": true,
    \"PriceClass\": \"PriceClass_100\",
    \"HttpVersion\": \"http2and3\",
    \"IsIPV6Enabled\": true
  }")

DISTRIBUTION_ID=$(echo "$DISTRIBUTION" | jq -r '.Distribution.Id')
DOMAIN_NAME=$(echo "$DISTRIBUTION" | jq -r '.Distribution.DomainName')

echo "✅ Distribution CloudFront créée : $DISTRIBUTION_ID"
echo "   URL : https://$DOMAIN_NAME"
echo ""

# =============================================================================
# Étape 5 : Attendre que la distribution soit déployée
# =============================================================================
echo "⏳ Attente du déploiement CloudFront (peut prendre 5-15 min)..."

DISTRIBUTION_STATUS="InProgress"
while [ "$DISTRIBUTION_STATUS" != "Deployed" ]; do
    sleep 30
    DISTRIBUTION_STATUS=$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" --region "$REGION" | jq -r '.Distribution.Status')
    echo "   Statut actuel : $DISTRIBUTION_STATUS"
done

echo "✅ Distribution CloudFront déployée"
echo ""

# =============================================================================
# Étape 6 : Upload du build frontend (si le dossier existe)
# =============================================================================
FRONTEND_BUILD_DIR="../frontend/dist"

if [ -d "$FRONTEND_BUILD_DIR" ]; then
    echo "📤 Upload du build frontend depuis $FRONTEND_BUILD_DIR..."
    aws s3 sync "$FRONTEND_BUILD_DIR" "s3://$BUCKET_NAME" --delete --region "$REGION"
    echo "✅ Build frontend uploadé"
else
    echo "⚠️  Dossier $FRONTEND_BUILD_DIR introuvable. Le build frontend devra être uploadé manuellement."
    echo "   Commande à exécuter plus tard :"
    echo "   aws s3 sync ../frontend/dist s3://$BUCKET_NAME --delete --region $REGION"
fi

echo ""

# =============================================================================
# Sauvegarder les infos
# =============================================================================
echo "📋 Sauvegarde des infos..."
cat > ../.env.frontend << EOF
# Frontend Configuration
FRONTEND_BUCKET=$BUCKET_NAME
FRONTEND_CLOUDFRONT_ID=$DISTRIBUTION_ID
FRONTEND_URL=https://$DOMAIN_NAME
FRONTEND_S3_URL=http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com
EOF

if ! grep -q "^\.env\.frontend$" ../.gitignore; then
    echo ".env.frontend" >> ../.gitignore
fi

echo "✅ Infos sauvegardées dans ../.env.frontend"

# =============================================================================
echo ""
echo "✅ Déploiement Frontend terminé !"
echo ""
echo "📋 Résumé :"
echo "   Bucket S3 : $BUCKET_NAME"
echo "   URL S3 : http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo "   URL CloudFront : https://$DOMAIN_NAME"
echo "   Distribution ID : $DISTRIBUTION_ID"
echo ""
echo "🎯 Pour accéder au frontend :"
echo "   Ouvrez https://$DOMAIN_NAME dans votre navigateur"
echo ""
echo "⚠️  Le déploiement complet est terminé !"
echo "   Vous pouvez maintenant tester l'application."
