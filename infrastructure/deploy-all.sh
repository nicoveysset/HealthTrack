#!/bin/bash

# =============================================================================
# HealthTrack - Script de déploiement complet AWS
# =============================================================================
# Ce script déploie toute l'infrastructure HealthTrack sur AWS.
# Ordre d'exécution : Cognito → DynamoDB → Lambdas → API Gateway → Frontend
# Durée estimée : 10-15 minutes
#
# Prérequis :
#   - AWS CLI installé et configuré (`aws configure`)
#   - jq installé (pour parser JSON)
#   - Compte AWS avec permissions admins
# =============================================================================

set -e  # Arrête le script si une commande échoue

REGION="eu-west-1"
STACK_NAME="healthtrack"

echo "=========================================="
echo "  Déploiement HealthTrack sur AWS"
echo "  Région : $REGION"
echo "=========================================="
echo ""

# -------------------------------------------
# Étape 0 : Vérification des prérequis
# -------------------------------------------
echo "⏳ [Étape 0/5] Vérification des prérequis..."

# Vérifier AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI non installé. Veuillez l'installer : https://aws.amazon.com/cli/"
    exit 1
fi

# Vérifier jq
if ! command -v jq &> /dev/null; then
    echo "❌ jq non installé. Veuillez l'installer : https://stedolan.github.io/jq/"
    exit 1
fi

# Vérifier la connexion AWS
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI non configuré. Exécutez : aws configure"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
echo "✅ Connecté au compte AWS : $AWS_ACCOUNT_ID"
echo ""

# -------------------------------------------
# Étape 1 : Déploiement Cognito (OPTIONNEL)
# Sur AWS Academy (compte student), cognito-idp:CreateUserPool est souvent
# bloqué. Dans ce cas on passe en mode JWT maison (Option B du PLAN.md) :
# la Lambda vérifie elle-même le token via jwt.verify(token, JWT_SECRET).
# -------------------------------------------
echo "🔐 [Étape 1/5] Tentative de déploiement Cognito (optionnel)..."
if [ -f "./deploy-cognito.sh" ]; then
    if ./deploy-cognito.sh 2>&1; then
        echo "✅ Cognito déployé (mode Cognito)"
    else
        echo "⚠️  Cognito non disponible (permissions insuffisantes ?) → mode JWT maison"
    fi
else
    echo "⚠️  deploy-cognito.sh absent → mode JWT maison"
fi
echo ""

# -------------------------------------------
# Étape 2 : Déploiement DynamoDB
# -------------------------------------------
echo "💾 [Étape 2/5] Déploiement DynamoDB (11 tables)..."
if [ -f "./deploy-dynamodb.sh" ]; then
    ./deploy-dynamodb.sh
else
    echo "❌ Fichier deploy-dynamodb.sh introuvable !"
    exit 1
fi
echo "✅ DynamoDB déployé"
echo ""

# -------------------------------------------
# Étape 3 : Déploiement des Lambdas
# -------------------------------------------
echo "⚡ [Étape 3/5] Déploiement des 4 Lambdas..."
if [ -f "./deploy-lambdas.sh" ]; then
    ./deploy-lambdas.sh
else
    echo "❌ Fichier deploy-lambdas.sh introuvable !"
    exit 1
fi
echo "✅ Lambdas déployées"
echo ""

# -------------------------------------------
# Étape 4 : Déploiement API Gateway
# -------------------------------------------
echo "🌐 [Étape 4/5] Déploiement des 4 API Gateways..."
if [ -f "./deploy-apigateway.sh" ]; then
    ./deploy-apigateway.sh
else
    echo "❌ Fichier deploy-apigateway.sh introuvable !"
    exit 1
fi
echo "✅ API Gateways déployées"
echo ""

# -------------------------------------------
# Étape 5 : Déploiement Frontend
# -------------------------------------------
echo "🎨 [Étape 5/5] Déploiement Frontend (S3 + CloudFront)..."
if [ -f "./deploy-frontend.sh" ]; then
    ./deploy-frontend.sh
else
    echo "❌ Fichier deploy-frontend.sh introuvable !"
    exit 1
fi
echo "✅ Frontend déployé"
echo ""

# -------------------------------------------
# Résumé
# -------------------------------------------
echo "=========================================="
echo "  ✅ Déploiement terminé !"
echo "=========================================="
echo ""
echo "Pour tester :"
echo "1. Accédez au frontend : [URL CloudFront affiché ci-dessus]"
echo "2. Test API Utilisateurs : curl -X POST [API_GATEWAY_URL]/auth/register"
echo "3. Vérifiez les logs : AWS Console → CloudWatch → Log Groups"
echo ""
echo "Pour nettoyer : ./cleanup.sh"
