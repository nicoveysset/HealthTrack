#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REGION="${AWS_REGION:-eu-west-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

mkdir -p "$PROJECT_ROOT"
ENV_FILE="$PROJECT_ROOT/.env.apigateway"
: > "$ENV_FILE"

deploy_api() {
  local api_name="$1"
  local function_name="$2"
  local lambda_arn
  local api_id
  local integration_id
  local route_id
  local stage_name
  local api_url
  local statement_id
  local current_policy

  lambda_arn="$(aws lambda get-function \
    --function-name "$function_name" \
    --region "$REGION" \
    --query Configuration.FunctionArn \
    --output text)"

  api_id="$(aws apigatewayv2 get-apis \
    --region "$REGION" \
    --query "Items[?Name=='$api_name'].ApiId | [0]" \
    --output text)"

  if [[ -z "$api_id" || "$api_id" == "None" ]]; then
    api_id="$(aws apigatewayv2 create-api \
      --name "$api_name" \
      --protocol-type HTTP \
      --cors-configuration 'AllowOrigins=["*"],AllowMethods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"],AllowHeaders=["authorization","content-type"]' \
      --region "$REGION" \
      --query ApiId \
      --output text)"
    echo "Created HTTP API $api_name ($api_id)"
  else
    aws apigatewayv2 update-api \
      --api-id "$api_id" \
      --cors-configuration 'AllowOrigins=["*"],AllowMethods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"],AllowHeaders=["authorization","content-type"]' \
      --region "$REGION" >/dev/null
    echo "Updating HTTP API $api_name ($api_id)"
  fi

  integration_id="$(aws apigatewayv2 get-integrations \
    --api-id "$api_id" \
    --region "$REGION" \
    --query 'Items[0].IntegrationId' \
    --output text)"

  if [[ -z "$integration_id" || "$integration_id" == "None" ]]; then
    integration_id="$(aws apigatewayv2 create-integration \
      --api-id "$api_id" \
      --integration-type AWS_PROXY \
      --integration-uri "$lambda_arn" \
      --integration-method POST \
      --payload-format-version 2.0 \
      --timeout-in-millis 30000 \
      --region "$REGION" \
      --query IntegrationId \
      --output text)"
  else
    aws apigatewayv2 update-integration \
      --api-id "$api_id" \
      --integration-id "$integration_id" \
      --integration-type AWS_PROXY \
      --integration-uri "$lambda_arn" \
      --integration-method POST \
      --payload-format-version 2.0 \
      --timeout-in-millis 30000 \
      --region "$REGION" >/dev/null
  fi

  route_id="$(aws apigatewayv2 get-routes \
    --api-id "$api_id" \
    --region "$REGION" \
    --query "Items[?RouteKey=='\$default'].RouteId | [0]" \
    --output text)"

  if [[ -z "$route_id" || "$route_id" == "None" ]]; then
    aws apigatewayv2 create-route \
      --api-id "$api_id" \
      --route-key '$default' \
      --target "integrations/$integration_id" \
      --region "$REGION" >/dev/null
  else
    aws apigatewayv2 update-route \
      --api-id "$api_id" \
      --route-id "$route_id" \
      --route-key '$default' \
      --target "integrations/$integration_id" \
      --region "$REGION" >/dev/null
  fi

  stage_name="$(aws apigatewayv2 get-stages \
    --api-id "$api_id" \
    --region "$REGION" \
    --query "Items[?StageName=='\$default'].StageName | [0]" \
    --output text)"

  if [[ -z "$stage_name" || "$stage_name" == "None" ]]; then
    aws apigatewayv2 create-stage \
      --api-id "$api_id" \
      --stage-name '$default' \
      --auto-deploy \
      --region "$REGION" >/dev/null
  else
    aws apigatewayv2 update-stage \
      --api-id "$api_id" \
      --stage-name '$default' \
      --auto-deploy \
      --region "$REGION" >/dev/null
  fi

  statement_id="apigateway-$api_id"
  current_policy="$(aws lambda get-policy \
    --function-name "$function_name" \
    --region "$REGION" \
    --query Policy \
    --output text 2>/dev/null || true)"

  if [[ -z "$current_policy" ]] || ! jq -e --arg sid "$statement_id" \
    '.Statement[]? | select(.Sid == $sid)' >/dev/null <<<"$current_policy"; then
    aws lambda add-permission \
      --function-name "$function_name" \
      --statement-id "$statement_id" \
      --action lambda:InvokeFunction \
      --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$api_id/*" \
      --region "$REGION" >/dev/null
  fi

  api_url="$(aws apigatewayv2 get-api \
    --api-id "$api_id" \
    --region "$REGION" \
    --query ApiEndpoint \
    --output text)"
  printf '%s=%s\n' "$3" "$api_url" >> "$ENV_FILE"
  echo "$api_name: $api_url"
}

for command in aws jq; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

deploy_api healthtrack-api-utilisateurs healthtrack-api-utilisateurs UTILISATEURS_API_URL
deploy_api healthtrack-api-rdv healthtrack-api-rdv RDV_API_URL
deploy_api healthtrack-api-dossiers healthtrack-api-dossiers DOSSIERS_API_URL
deploy_api healthtrack-api-ordonnances healthtrack-api-ordonnances ORDONNANCES_API_URL

echo "API Gateway URLs saved to $ENV_FILE"
