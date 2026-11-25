#!/bin/bash

# =============================================================================
# HealthTrack - Nettoyage des ressources AWS
# =============================================================================
# Supprime toutes les ressources créées par les scripts de déploiement.
# ⚠️ ATTENTION : Ce script supprime des ressources de manière irréversible.
# =============================================================================

set -e

REGION="eu-west-1"

echo "🧹 [Cleanup] Suppression des ressources AWS..."
echo ""

# =============================================================================
# Étape 1 : Supprimer CloudFront
# =============================================================================
echo "🌍 [1/7] Suppression des distributions CloudFront..."

# Lister toutes les distributions
DISTRIBUTIONS=$(aws cloudfront list-distributions --region "$REGION" | jq -r '.DistributionList.Items[] | select(.Comment | contains("HealthTrack")) | .Id')

for DIST_ID in $DISTRIBUTIONS; do
    echo "  Suppression de la distribution : $DIST_ID..."
    
    # Désactiver la distribution
    aws cloudfront get-distribution-config --id "$DIST_ID" --region "$REGION" > /tmp/dist-config.json
    
    # Mettre à jour la configuration pour désactiver
    jq 'del(.ETag) | .DistributionConfig.Enabled = false' /tmp/dist-config.json > /tmp/dist-config-updated.json
    
    ETAG=$(jq -r '.ETag' /tmp/dist-config.json)
    
    aws cloudfront update-distribution \
      --id "$DIST_ID" \
      --if-match "$ETAG" \
      --distribution-config "$(cat /tmp/dist-config-updated.json)" \
      --region "$REGION"
    
    # Attendre que la distribution soit désactivée
    sleep 10
    
    # Supprimer la distribution
    aws cloudfront delete-distribution \
      --id "$DIST_ID" \
      --if-match "$ETAG" \
      --region "$REGION"
    
    echo "  ✅ Distribution supprimée : $DIST_ID"
done

echo ""

# =============================================================================
# Étape 2 : Supprimer les buckets S3
# =============================================================================
echo "📦 [2/7] Suppression des buckets S3..."

BUCKETS=$(aws s3api list-buckets --region "$REGION" | jq -r '.Buckets[] | select(.Name | startswith("healthtrack")) | .Name')

for BUCKET in $BUCKETS; do
    echo "  Suppression du bucket : $BUCKET..."
    
    # Vider le bucket
    aws s3 rb "s3://$BUCKET" --force --region "$REGION"
    
    echo "  ✅ Bucket supprimé : $BUCKET"
done

echo ""

# =============================================================================
# Étape 3 : Supprimer API Gateways
# =============================================================================
echo "🌐 [3/7] Suppression des API Gateways..."

APIS=$(aws apigateway get-rest-apis --region "$REGION" | jq -r '.items[] | select(.name | startswith("healthtrack")) | .id')

for API_ID in $APIS; do
    echo "  Suppression de l'API Gateway : $API_ID..."
    
    # Supprimer toutes les ressources
    RESOURCES=$(aws apigateway get-resources --rest-api-id "$API_ID" --region "$REGION" | jq -r '.items[] | .id')
    
    for RESOURCE_ID in $RESOURCES; do
        # Supprimer toutes les méthodes
        METHODS=$(aws apigateway get-resource --rest-api-id "$API_ID" --resource-id "$RESOURCE_ID" --region "$REGION" | jq -r '.resourceMethods | keys[]')
        
        for METHOD in $METHODS; do
            aws apigateway delete-method \
              --rest-api-id "$API_ID" \
              --resource-id "$RESOURCE_ID" \
              --http-method "$METHOD" \
              --region "$REGION" 2>/dev/null || true
        done
    done
    
    # Supprimer l'API
    aws apigateway delete-rest-api \
      --rest-api-id "$API_ID" \
      --region "$REGION"
    
    echo "  ✅ API Gateway supprimée : $API_ID"
done

echo ""

# =============================================================================
# Étape 4 : Supprimer les Lambdas
# =============================================================================
echo "⚡ [4/7] Suppression des Lambdas..."

LAMBDAS=$(aws lambda list-functions --region "$REGION" | jq -r '.Functions[] | select(.FunctionName | startswith("healthtrack")) | .FunctionName')

for LAMBDA in $LAMBDAS; do
    echo "  Suppression de la Lambda : $LAMBDA..."
    
    aws lambda delete-function \
      --function-name "$LAMBDA" \
      --region "$REGION"
    
    echo "  ✅ Lambda supprimée : $LAMBDA"
done

echo ""

# =============================================================================
# Étape 5 : Supprimer les rôles IAM
# =============================================================================
echo "👤 [5/7] Suppression des rôles IAM..."

ROLES=$(aws iam list-roles --region "$REGION" | jq -r '.Roles[] | select(.RoleName | startswith("HealthTrack")) | .RoleName')

for ROLE in $ROLES; do
    echo "  Suppression du rôle : $ROLE..."
    
    # Détacher toutes les politiques
    POLICIES=$(aws iam list-attached-role-policies --role-name "$ROLE" --region "$REGION" | jq -r '.AttachedPolicies[] | .PolicyArn')
    
    for POLICY in $POLICIES; do
        aws iam detach-role-policy \
          --role-name "$ROLE" \
          --policy-arn "$POLICY" \
          --region "$REGION"
    done
    
    # Supprimer le rôle
    aws iam delete-role \
      --role-name "$ROLE" \
      --region "$REGION"
    
    echo "  ✅ Rôle supprimé : $ROLE"
done

echo ""

# =============================================================================
# Étape 6 : Supprimer les politiques IAM
# =============================================================================
echo "📜 [6/7] Suppression des politiques IAM..."

POLICIES=$(aws iam list-policies --scope Local --region "$REGION" | jq -r '.Policies[] | select(.PolicyName | startswith("HealthTrack")) | .PolicyName')

for POLICY in $POLICIES; do
    echo "  Suppression de la politique : $POLICY..."
    
    # Récupérer l'ARN de la politique
    POLICY_ARN=$(aws iam list-policies --scope Local --region "$REGION" | jq -r --arg policy "$POLICY" '.Policies[] | select(.PolicyName == $policy) | .Arn')
    
    # Supprimer les versions de la politique
    VERSIONS=$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --region "$REGION" | jq -r '.Versions[] | select(.IsDefaultVersion == false) | .VersionId')
    
    for VERSION in $VERSIONS; do
        aws iam delete-policy-version \
          --policy-arn "$POLICY_ARN" \
          --version-id "$VERSION" \
          --region "$REGION"
    done
    
    # Supprimer la politique
    aws iam delete-policy \
      --policy-arn "$POLICY_ARN" \
      --region "$REGION"
    
    echo "  ✅ Politique supprimée : $POLICY"
done

echo ""

# =============================================================================
# Étape 7 : Supprimer DynamoDB
# =============================================================================
echo "💾 [7/7] Suppression des tables DynamoDB..."

TABLES=$(aws dynamodb list-tables --region "$REGION" | jq -r '.TableNames[] | select(. | startswith("healthtrack"))')

for TABLE in $TABLES; do
    echo "  Suppression de la table : $TABLE..."
    
    aws dynamodb delete-table \
      --table-name "$TABLE" \
      --region "$REGION"
    
    # Attendre que la table soit supprimée
    aws dynamodb wait table-not-exists \
      --table-name "$TABLE" \
      --region "$REGION"
    
    echo "  ✅ Table supprimée : $TABLE"
done

echo ""

# =============================================================================
# Étape 8 : Supprimer Cognito
# =============================================================================
echo "🔐 [8/8] Suppression de Cognito..."

# Supprimer l'App Client
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --region "$REGION" | jq -r '.UserPools[] | select(.Name == "HealthTrack-UserPool") | .Id')

if [ -n "$USER_POOL_ID" ]; then
    APP_CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --max-results 10 --region "$REGION" | jq -r '.UserPoolClients[] | select(.ClientName == "HealthTrack-AppClient") | .ClientId')
    
    if [ -n "$APP_CLIENT_ID" ]; then
        echo "  Suppression de l'App Client : $APP_CLIENT_ID..."
        aws cognito-idp delete-user-pool-client \
          --user-pool-id "$USER_POOL_ID" \
          --client-id "$APP_CLIENT_ID" \
          --region "$REGION"
        echo "  ✅ App Client supprimé"
    fi
    
    # Supprimer le Domain
    DOMAIN_NAME=$(aws cognito-idp list-user-pool-domains --user-pool-id "$USER_POOL_ID" --max-results 10 --region "$REGION" | jq -r '.Domains[] | select(.Domain == "healthtrack-auth") | .Domain')
    
    if [ -n "$DOMAIN_NAME" ]; then
        echo "  Suppression du Domain : $DOMAIN_NAME..."
        aws cognito-idp delete-user-pool-domain \
          --domain "$DOMAIN_NAME" \
          --user-pool-id "$USER_POOL_ID" \
          --region "$REGION"
        echo "  ✅ Domain supprimé"
    fi
    
    # Supprimer le User Pool
    echo "  Suppression du User Pool : $USER_POOL_ID..."
    aws cognito-idp delete-user-pool \
      --user-pool-id "$USER_POOL_ID" \
      --region "$REGION"
    echo "  ✅ User Pool supprimé"
fi

echo ""

# =============================================================================
# Supprimer les fichiers .env
# =============================================================================
echo "📝 Suppression des fichiers .env..."

cd ..
rm -f .env.cognito .env.lambdas .env.apigateway .env.frontend

echo "✅ Fichiers .env supprimés"

echo ""

# =============================================================================
echo "✅ Nettoyage terminé !"
echo ""
echo "Toutes les ressources HealthTrack ont été supprimées de la région $REGION."
