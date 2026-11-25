#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
export AWS_REGION="${AWS_REGION:-eu-west-1}"

for command in aws jq mvn npm; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "AWS CLI is not configured. Run aws configure first." >&2
  exit 1
fi

echo "Deploying HealthTrack to AWS region $AWS_REGION"
echo "Authentication: application-managed JWT (Cognito is not used by this build)"

cd "$SCRIPT_DIR"
./deploy-dynamodb.sh
./deploy-lambdas.sh
./deploy-apigateway.sh
./deploy-frontend.sh

echo
echo "Deployment completed."
echo "API endpoints: $PROJECT_ROOT/.env.apigateway"
echo "Frontend endpoint: $PROJECT_ROOT/.env.frontend"
echo "JWT secret: $PROJECT_ROOT/.env.jwt_secret (keep private)"
