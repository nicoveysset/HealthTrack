#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
REGION="${AWS_REGION:-us-east-1}"
# CloudFront est interdit sur AWS Academy Learner Lab : desactive par defaut.
# Sur un compte AWS classique : USE_CLOUDFRONT=true ./deploy-frontend.sh
USE_CLOUDFRONT="${USE_CLOUDFRONT:-false}"

for command in aws jq npm; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

if [[ ! -f "$PROJECT_ROOT/.env.apigateway" ]]; then
  echo "Missing .env.apigateway. Deploy API Gateway before the frontend." >&2
  exit 1
fi

# These URLs are public endpoints and are compiled into the Vite bundle.
# shellcheck source=/dev/null
source "$PROJECT_ROOT/.env.apigateway"

export VITE_API_UTILISATEURS_URL="$UTILISATEURS_API_URL"
export VITE_API_RDV_URL="$RDV_API_URL"
export VITE_API_DOSSIERS_URL="$DOSSIERS_API_URL"
export VITE_API_ORDONNANCES_URL="$ORDONNANCES_API_URL"

echo "Building frontend with deployed API URLs..."
cd "$FRONTEND_DIR"
npm ci
npm run build

# Le frontend lit ses URLs dans window.healthtrackConfig (public/config.js),
# pas dans les variables VITE_* : on ecrit les vraies URLs API Gateway
# dans le config.js publie.
cat > "$FRONTEND_DIR/dist/config.js" <<EOF
window.healthtrackConfig = {
  API_UTILISATEURS_URL: "$UTILISATEURS_API_URL",
  API_RDV_URL: "$RDV_API_URL",
  API_DOSSIERS_URL: "$DOSSIERS_API_URL",
  API_ORDONNANCES_URL: "$ORDONNANCES_API_URL"
};
EOF
echo "config.js written with API Gateway URLs"

# Reutilise le bucket d'un deploiement precedent : l'URL du site ne change pas
if [[ -z "${FRONTEND_BUCKET:-}" && -f "$PROJECT_ROOT/.env.frontend" ]]; then
  FRONTEND_BUCKET="$(grep '^FRONTEND_BUCKET=' "$PROJECT_ROOT/.env.frontend" | cut -d= -f2)"
fi
BUCKET_NAME="${FRONTEND_BUCKET:-healthtrack-frontend-$(date +%s)-$RANDOM}"

if aws s3api head-bucket --bucket "$BUCKET_NAME" >/dev/null 2>&1; then
  echo "Reusing S3 bucket $BUCKET_NAME..."
else
  echo "Creating S3 bucket $BUCKET_NAME..."
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      --region "$REGION" \
      --object-ownership BucketOwnerEnforced
  else
    aws s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=$REGION" \
      --object-ownership BucketOwnerEnforced
  fi
fi

aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false \
  --region "$REGION"

aws s3api put-bucket-website \
  --bucket "$BUCKET_NAME" \
  --website-configuration '{"IndexDocument":{"Suffix":"index.html"},"ErrorDocument":{"Key":"index.html"}}' \
  --region "$REGION"

BUCKET_POLICY="$(jq -n --arg bucket "$BUCKET_NAME" '{
  Version: "2012-10-17",
  Statement: [{
    Sid: "PublicReadForStaticWebsite",
    Effect: "Allow",
    Principal: "*",
    Action: "s3:GetObject",
    Resource: ("arn:aws:s3:::" + $bucket + "/*")
  }]
}')"
aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy "$BUCKET_POLICY" --region "$REGION"

aws s3 sync "$FRONTEND_DIR/dist" "s3://$BUCKET_NAME" --delete --region "$REGION"

# index.html et config.js ne doivent jamais rester en cache dans le navigateur,
# sinon il continue a charger l'ancienne version du site apres un redeploiement
# (les fichiers JS/CSS ont un nom qui change a chaque build, eux).
for file in index.html config.js; do
  aws s3 cp "$FRONTEND_DIR/dist/$file" "s3://$BUCKET_NAME/$file" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --region "$REGION" --only-show-errors
done

WEBSITE_URL="http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
if ! grep -qxF '.env.frontend' "$PROJECT_ROOT/.gitignore"; then
  printf '\n.env.frontend\n' >> "$PROJECT_ROOT/.gitignore"
fi

if [[ "$USE_CLOUDFRONT" != "true" ]]; then
  printf 'FRONTEND_BUCKET=%s\nFRONTEND_URL=%s\n' "$BUCKET_NAME" "$WEBSITE_URL" > "$PROJECT_ROOT/.env.frontend"
  echo "Frontend deployed (site statique S3, sans CloudFront): $WEBSITE_URL"
  exit 0
fi

ORIGIN_DOMAIN="$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
DISTRIBUTION_CONFIG="$(jq -n \
  --arg caller "healthtrack-$(date +%s)-$RANDOM" \
  --arg bucket "$BUCKET_NAME" \
  --arg origin "$ORIGIN_DOMAIN" '{
    CallerReference: $caller,
    Comment: ("HealthTrack frontend " + $bucket),
    Enabled: true,
    DefaultRootObject: "index.html",
    Origins: {
      Quantity: 1,
      Items: [{
        Id: ("S3-website-" + $bucket),
        DomainName: $origin,
        CustomOriginConfig: {
          HTTPPort: 80,
          HTTPSPort: 443,
          OriginProtocolPolicy: "http-only",
          OriginSslProtocols: {Quantity: 1, Items: ["TLSv1.2"]}
        }
      }]
    },
    DefaultCacheBehavior: {
      TargetOriginId: ("S3-website-" + $bucket),
      ViewerProtocolPolicy: "redirect-to-https",
      AllowedMethods: {
        Quantity: 3,
        Items: ["GET", "HEAD", "OPTIONS"],
        CachedMethods: {Quantity: 2, Items: ["GET", "HEAD"]}
      },
      ForwardedValues: {
        QueryString: false,
        Cookies: {Forward: "none"}
      },
      MinTTL: 0,
      DefaultTTL: 3600,
      MaxTTL: 86400,
      Compress: true
    },
    CustomErrorResponses: {
      Quantity: 2,
      Items: [
        {ErrorCode: 403, ResponsePagePath: "/index.html", ResponseCode: "200", ErrorCachingMinTTL: 0},
        {ErrorCode: 404, ResponsePagePath: "/index.html", ResponseCode: "200", ErrorCachingMinTTL: 0}
      ]
    },
    PriceClass: "PriceClass_100",
    Restrictions: {GeoRestriction: {RestrictionType: "none", Quantity: 0}},
    ViewerCertificate: {CloudFrontDefaultCertificate: true},
    HttpVersion: "http2and3",
    IsIPV6Enabled: true
  }')"

echo "Creating CloudFront distribution..."
DISTRIBUTION="$(aws cloudfront create-distribution --distribution-config "$DISTRIBUTION_CONFIG")"
DISTRIBUTION_ID="$(jq -r '.Distribution.Id' <<<"$DISTRIBUTION")"
DOMAIN_NAME="$(jq -r '.Distribution.DomainName' <<<"$DISTRIBUTION")"

echo "Waiting for CloudFront deployment (this can take several minutes)..."
aws cloudfront wait distribution-deployed --id "$DISTRIBUTION_ID"

cat > "$PROJECT_ROOT/.env.frontend" <<EOF
FRONTEND_BUCKET=$BUCKET_NAME
FRONTEND_CLOUDFRONT_ID=$DISTRIBUTION_ID
FRONTEND_URL=https://$DOMAIN_NAME
EOF

echo "Frontend deployed: https://$DOMAIN_NAME"
echo "Bucket: $BUCKET_NAME"
echo "Distribution: $DISTRIBUTION_ID"
