#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"
TIMEOUT=30
MEMORY=1024

cd "$PROJECT_ROOT"

for command in aws mvn jq openssl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

if [[ -z "${JWT_SECRET:-}" ]]; then
  if [[ -f "$PROJECT_ROOT/.env.jwt_secret" ]]; then
    JWT_SECRET="$(<"$PROJECT_ROOT/.env.jwt_secret")"
  else
    JWT_SECRET="$(openssl rand -hex 32)"
  fi
fi

if [[ ${#JWT_SECRET} -lt 32 ]]; then
  echo "JWT_SECRET must be at least 32 characters." >&2
  exit 1
fi

umask 077
printf '%s' "$JWT_SECRET" > "$PROJECT_ROOT/.env.jwt_secret"
if ! grep -qxF '.env.jwt_secret' "$PROJECT_ROOT/.gitignore"; then
  printf '\n.env.jwt_secret\n' >> "$PROJECT_ROOT/.gitignore"
fi

echo "Building Java 21 Lambda artifacts..."
mvn -B -f "$PROJECT_ROOT/pom.xml" -DskipTests clean package

# -----------------------------------------------------------------------------
# AWS Academy Learner Lab : la creation de roles/politiques IAM est interdite.
# On utilise le role fourni "LabRole" (acces DynamoDB + CloudWatch Logs inclus).
# Pour un compte AWS classique, passer LAMBDA_ROLE_NAME=<votre role>.
# -----------------------------------------------------------------------------
LAMBDA_ROLE_NAME="${LAMBDA_ROLE_NAME:-LabRole}"
ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$LAMBDA_ROLE_NAME"

# Les JARs (~100 Mo) depassent la limite de 50 Mo d'un envoi direct
# (--zip-file) : ils sont d'abord deposes sur S3.
ARTIFACT_BUCKET="${ARTIFACT_BUCKET:-healthtrack-lambda-artifacts-$ACCOUNT_ID-$REGION}"
if ! aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" >/dev/null 2>&1; then
  echo "Creating artifact bucket $ARTIFACT_BUCKET..."
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
fi

deploy_lambda() {
  local function_name="$1"
  local handler="$2"
  local jar_path="$3"
  local s3_key="$function_name.jar"

  if [[ ! -f "$jar_path" ]]; then
    echo "Lambda JAR not found: $jar_path" >&2
    exit 1
  fi

  echo "Uploading $s3_key to s3://$ARTIFACT_BUCKET..."
  aws s3 cp "$jar_path" "s3://$ARTIFACT_BUCKET/$s3_key" --region "$REGION" --only-show-errors

  # AWS_REGION est une variable reservee : Lambda la fournit automatiquement.
  local env_vars="Variables={JWT_SECRET=$JWT_SECRET}"

  if aws lambda get-function --function-name "$function_name" --region "$REGION" >/dev/null 2>&1; then
    echo "Updating $function_name..."
    aws lambda update-function-code \
      --function-name "$function_name" \
      --s3-bucket "$ARTIFACT_BUCKET" \
      --s3-key "$s3_key" \
      --region "$REGION" >/dev/null
    aws lambda wait function-updated --function-name "$function_name" --region "$REGION"
    aws lambda update-function-configuration \
      --function-name "$function_name" \
      --runtime java21 \
      --handler "$handler" \
      --role "$ROLE_ARN" \
      --timeout "$TIMEOUT" \
      --memory-size "$MEMORY" \
      --environment "$env_vars" \
      --region "$REGION" >/dev/null
    aws lambda wait function-updated --function-name "$function_name" --region "$REGION"
  else
    echo "Creating $function_name..."
    aws lambda create-function \
      --function-name "$function_name" \
      --runtime java21 \
      --handler "$handler" \
      --role "$ROLE_ARN" \
      --code "S3Bucket=$ARTIFACT_BUCKET,S3Key=$s3_key" \
      --timeout "$TIMEOUT" \
      --memory-size "$MEMORY" \
      --environment "$env_vars" \
      --region "$REGION" >/dev/null
  fi

  aws lambda wait function-active --function-name "$function_name" --region "$REGION"
  echo "Deployed $function_name"
}

deploy_lambda \
  healthtrack-api-utilisateurs \
  com.healthtrack.utilisateurs.LambdaHandler \
  "$PROJECT_ROOT/api-utilisateurs/target/healthtrack-utilisateurs-1.0.0-lambda.jar"
deploy_lambda \
  healthtrack-api-rdv \
  com.healthtrack.rdv.LambdaHandler \
  "$PROJECT_ROOT/api-disponibilites-rdv/target/healthtrack-disponibilites-rdv-1.0.0-lambda.jar"
deploy_lambda \
  healthtrack-api-dossiers \
  com.healthtrack.dossiers.LambdaHandler \
  "$PROJECT_ROOT/api-dossiers-medicaux/target/healthtrack-dossiers-medicaux-1.0.0-lambda.jar"
deploy_lambda \
  healthtrack-api-ordonnances \
  com.healthtrack.ordonnances.LambdaHandler \
  "$PROJECT_ROOT/api-ordonnances/target/healthtrack-ordonnances-1.0.0-lambda.jar"

echo "Lambda deployment completed. JWT secret saved in .env.jwt_secret (do not commit)."
