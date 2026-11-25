#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REGION="${AWS_REGION:-eu-west-1}"
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
mvn -B -f "$PROJECT_ROOT/pom.xml" -DskipTests package

POLICY_NAME="HealthTrack-DynamoDB-Access"
POLICY_ARN="arn:aws:iam::$ACCOUNT_ID:policy/$POLICY_NAME"
POLICY_FILE="$(mktemp)"
trap 'rm -f "$POLICY_FILE"' EXIT

jq -n --arg region "$REGION" --arg account "$ACCOUNT_ID" '{
  Version: "2012-10-17",
  Statement: [{
    Effect: "Allow",
    Action: [
      "dynamodb:BatchGetItem", "dynamodb:BatchWriteItem",
      "dynamodb:DeleteItem", "dynamodb:GetItem", "dynamodb:PutItem",
      "dynamodb:Query", "dynamodb:Scan", "dynamodb:UpdateItem"
    ],
    Resource: [
      ("arn:aws:dynamodb:" + $region + ":" + $account + ":table/healthtrack-*"),
      ("arn:aws:dynamodb:" + $region + ":" + $account + ":table/healthtrack-*/index/*")
    ]
  }]
}' > "$POLICY_FILE"

if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
  old_versions="$(aws iam list-policy-versions \
    --policy-arn "$POLICY_ARN" \
    --query 'Versions[?IsDefaultVersion==`false`].VersionId' \
    --output text)"
  for version in $old_versions; do
    aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$version"
  done
  aws iam create-policy-version \
    --policy-arn "$POLICY_ARN" \
    --policy-document "file://$POLICY_FILE" \
    --set-as-default >/dev/null
else
  POLICY_ARN="$(aws iam create-policy \
    --policy-name "$POLICY_NAME" \
    --policy-document "file://$POLICY_FILE" \
    --query Policy.Arn --output text)"
fi

deploy_lambda() {
  local function_name="$1"
  local handler="$2"
  local jar_path="$3"
  local role_name="$4"
  local role_arn="arn:aws:iam::$ACCOUNT_ID:role/$role_name"

  if [[ ! -f "$jar_path" ]]; then
    echo "Lambda JAR not found: $jar_path" >&2
    exit 1
  fi

  if ! aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
    jq -n '{
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Principal: {Service: "lambda.amazonaws.com"},
        Action: "sts:AssumeRole"
      }]
    }' > "$POLICY_FILE"
    aws iam create-role \
      --role-name "$role_name" \
      --assume-role-policy-document "file://$POLICY_FILE" >/dev/null
    sleep 10
  fi

  aws iam attach-role-policy \
    --role-name "$role_name" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  aws iam attach-role-policy --role-name "$role_name" --policy-arn "$POLICY_ARN"

  if aws lambda get-function --function-name "$function_name" --region "$REGION" >/dev/null 2>&1; then
    echo "Updating $function_name..."
    aws lambda update-function-code \
      --function-name "$function_name" \
      --zip-file "fileb://$jar_path" \
      --region "$REGION" >/dev/null
    aws lambda wait function-updated --function-name "$function_name" --region "$REGION"
    aws lambda update-function-configuration \
      --function-name "$function_name" \
      --runtime java21 \
      --handler "$handler" \
      --role "$role_arn" \
      --timeout "$TIMEOUT" \
      --memory-size "$MEMORY" \
      --environment "Variables={JWT_SECRET=$JWT_SECRET,AWS_REGION=$REGION}" \
      --region "$REGION" >/dev/null
    aws lambda wait function-updated --function-name "$function_name" --region "$REGION"
  else
    echo "Creating $function_name..."
    aws lambda create-function \
      --function-name "$function_name" \
      --runtime java21 \
      --handler "$handler" \
      --role "$role_arn" \
      --zip-file "fileb://$jar_path" \
      --timeout "$TIMEOUT" \
      --memory-size "$MEMORY" \
      --environment "Variables={JWT_SECRET=$JWT_SECRET,AWS_REGION=$REGION}" \
      --region "$REGION" >/dev/null
  fi

  aws lambda wait function-active --function-name "$function_name" --region "$REGION"
  echo "Deployed $function_name"
}

deploy_lambda \
  healthtrack-api-utilisateurs \
  com.healthtrack.utilisateurs.LambdaHandler \
  "$PROJECT_ROOT/api-utilisateurs/target/healthtrack-utilisateurs-1.0.0-lambda.jar" \
  HealthTrack-Lambda-Utilisateurs-Role
deploy_lambda \
  healthtrack-api-rdv \
  com.healthtrack.rdv.LambdaHandler \
  "$PROJECT_ROOT/api-disponibilites-rdv/target/healthtrack-disponibilites-rdv-1.0.0-lambda.jar" \
  HealthTrack-Lambda-RDV-Role
deploy_lambda \
  healthtrack-api-dossiers \
  com.healthtrack.dossiers.LambdaHandler \
  "$PROJECT_ROOT/api-dossiers-medicaux/target/healthtrack-dossiers-medicaux-1.0.0-lambda.jar" \
  HealthTrack-Lambda-Dossiers-Role
deploy_lambda \
  healthtrack-api-ordonnances \
  com.healthtrack.ordonnances.LambdaHandler \
  "$PROJECT_ROOT/api-ordonnances/target/healthtrack-ordonnances-1.0.0-lambda.jar" \
  HealthTrack-Lambda-Ordonnances-Role

echo "Lambda deployment completed. JWT secret saved in .env.jwt_secret (do not commit)."
