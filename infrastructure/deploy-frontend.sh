#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
REGION="${AWS_REGION:-eu-west-1}"
BUCKET_NAME="healthtrack-frontend-$(date +%s)-$RANDOM"

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
if ! grep -qxF '.env.frontend' "$PROJECT_ROOT/.gitignore"; then
  printf '\n.env.frontend\n' >> "$PROJECT_ROOT/.gitignore"
fi

echo "Frontend deployed: https://$DOMAIN_NAME"
echo "Bucket: $BUCKET_NAME"
echo "Distribution: $DISTRIBUTION_ID"
