#!/usr/bin/env bash
# =============================================================================
# HealthTrack — Alarmes CloudWatch sur les alertes métier
#
# L'API Ordonnances publie ses alertes au format CloudWatch Embedded Metric Format (EMF) :
# Lambda transforme automatiquement ces lignes de log en métriques dans le namespace
# "HealthTrack/Ordonnances" (aucune permission IAM supplémentaire n'est nécessaire).
#
# Ce script crée deux alarmes sur ces métriques :
#   - HealthTrack-PrescriptionLongueDuree : une ligne de prescription > 90 jours a été saisie
#   - HealthTrack-AllergyConflict         : un praticien a tenté de prescrire un médicament allergène
#
# Visibles dans : Console AWS > CloudWatch > Alarmes
# =============================================================================
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
NAMESPACE="HealthTrack/Ordonnances"

create_alarm() {
  local name="$1" metric="$2" description="$3"
  aws cloudwatch put-metric-alarm \
    --region "$REGION" \
    --alarm-name "$name" \
    --alarm-description "$description" \
    --namespace "$NAMESPACE" \
    --metric-name "$metric" \
    --dimensions Name=Service,Value=api-ordonnances \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --treat-missing-data notBreaching
  echo "✅ Alarme $name créée (métrique $NAMESPACE/$metric)"
}

create_alarm "HealthTrack-PrescriptionLongueDuree" "PrescriptionLongueDuree" \
  "Alerte métier : ligne de prescription d'une durée supérieure à 90 jours"
create_alarm "HealthTrack-AllergyConflict" "AllergyConflict" \
  "Tentative de prescription d'un médicament auquel le patient est allergique"

echo
echo "Logs applicatifs : CloudWatch > Groupes de journaux > /aws/lambda/healthtrack-api-*"
echo "Exemple Logs Insights (groupe /aws/lambda/healthtrack-api-dossiers) :"
echo '  fields @timestamp, @message | filter @message like /ALLERGIE_UPDATED/ | sort @timestamp desc'
