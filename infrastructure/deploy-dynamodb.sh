#!/bin/bash

# =============================================================================
# HealthTrack - Déploiement DynamoDB
# =============================================================================
# Crée les 12 tables DynamoDB avec leurs clés et GSIs
# Mode : PAY_PER_REQUEST (pas de capacité provisionnée)
# =============================================================================

set -e

REGION="eu-west-1"

echo "💾 [DynamoDB] Création des 12 tables..."
echo ""

# =============================================================================
# 1. Table Utilisateurs
# =============================================================================
echo "📋 [1/12] Création de la table Utilisateurs..."
aws dynamodb create-table \
  --table-name healthtrack-utilisateurs \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=email,AttributeType=S \
    AttributeName=medecinTraitantId,AttributeType=S \
    AttributeName=type,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "byEmail",
        "KeySchema": [{"AttributeName": "email", "KeyType": "HASH"}],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byMedecinTraitant",
        "KeySchema": [
          {"AttributeName": "medecinTraitantId", "KeyType": "HASH"},
          {"AttributeName": "type", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

# Attendre que la table soit active
aws dynamodb wait table-exists --table-name healthtrack-utilisateurs --region "$REGION"
echo "✅ Table healthtrack-utilisateurs créée"

# =============================================================================
# 2. Table DossiersMedicaux
# =============================================================================
echo "📋 [2/12] Création de la table DossiersMedicaux..."
aws dynamodb create-table \
  --table-name healthtrack-dossiers-medicaux \
  --attribute-definitions \
    AttributeName=patientId,AttributeType=S \
  --key-schema \
    AttributeName=patientId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

aws dynamodb wait table-exists --table-name healthtrack-dossiers-medicaux --region "$REGION"
echo "✅ Table healthtrack-dossiers-medicaux créée"

# =============================================================================
# 3. Table Antecedents
# =============================================================================
echo "📋 [3/12] Création de la table Antecedents..."
aws dynamodb create-table \
  --table-name healthtrack-antecedents \
  --attribute-definitions \
    AttributeName=antecedentId,AttributeType=S \
    AttributeName=dossierId,AttributeType=S \
    AttributeName=type,AttributeType=S \
    AttributeName=statut,AttributeType=S \
  --key-schema \
    AttributeName=antecedentId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "byDossier",
        "KeySchema": [{"AttributeName": "dossierId", "KeyType": "HASH"}],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byDossierAndType",
        "KeySchema": [
          {"AttributeName": "dossierId", "KeyType": "HASH"},
          {"AttributeName": "type", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byStatut",
        "KeySchema": [
          {"AttributeName": "statut", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

aws dynamodb wait table-exists --table-name healthtrack-antecedents --region "$REGION"
echo "✅ Table healthtrack-antecedents créée"

# =============================================================================
# 4. Table Allergies
# =============================================================================
echo "📋 [4/12] Création de la table Allergies..."
aws dynamodb create-table \
  --table-name healthtrack-allergies \
  --attribute-definitions \
    AttributeName=allergieId,AttributeType=S \
    AttributeName=patientId,AttributeType=S \
  --key-schema \
    AttributeName=allergieId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "byPatient",
        "KeySchema": [
          {"AttributeName": "patientId", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

aws dynamodb wait table-exists --table-name healthtrack-allergies --region "$REGION"
echo "✅ Table healthtrack-allergies créée"

# =============================================================================
# 5. Table Vaccinations
# =============================================================================
echo "📋 [5/12] Création de la table Vaccinations..."
aws dynamodb create-table \
  --table-name healthtrack-vaccinations \
  --attribute-definitions \
    AttributeName=vaccinationId,AttributeType=S \
    AttributeName=dossierId,AttributeType=S \
    AttributeName=nomVaccin,AttributeType=S \
  --key-schema \
    AttributeName=vaccinationId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "byDossier",
        "KeySchema": [{"AttributeName": "dossierId", "KeyType": "HASH"}],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byDossierAndNom",
        "KeySchema": [
          {"AttributeName": "dossierId", "KeyType": "HASH"},
          {"AttributeName": "nomVaccin", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

aws dynamodb wait table-exists --table-name healthtrack-vaccinations --region "$REGION"
echo "✅ Table healthtrack-vaccinations créée"

# =============================================================================
# 6. Table Disponibilites
# =============================================================================
echo "📋 [6/12] Création de la table Disponibilites..."
aws dynamodb create-table \
  --table-name healthtrack-disponibilites \
  --attribute-definitions \
    AttributeName=dispoId,AttributeType=S \
    AttributeName=praticienId,AttributeType=S \
    AttributeName=jourSemaine,AttributeType=S \
  --key-schema \
    AttributeName=dispoId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "byPraticien",
        "KeySchema": [
          {"AttributeName": "praticienId", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byPraticienAndJour",
        "KeySchema": [
          {"AttributeName": "praticienId", "KeyType": "HASH"},
          {"AttributeName": "jourSemaine", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

aws dynamodb wait table-exists --table-name healthtrack-disponibilites --region "$REGION"
echo "✅ Table healthtrack-disponibilites créée"

# =============================================================================
# 7. Table Indisponibilites
# =============================================================================
echo "📋 [7/12] Création de la table Indisponibilites..."
aws dynamodb create-table \
  --table-name healthtrack-indisponibilites \
  --attribute-definitions \
    AttributeName=indispoId,AttributeType=S \
    AttributeName=praticienId,AttributeType=S \
    AttributeName=dateDebut,AttributeType=S \
    AttributeName=dateFin,AttributeType=S \
  --key-schema \
    AttributeName=indispoId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "byPraticien",
        "KeySchema": [
          {"AttributeName": "praticienId", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byPraticienAndDate",
        "KeySchema": [
          {"AttributeName": "praticienId", "KeyType": "HASH"},
          {"AttributeName": "dateDebut", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

aws dynamodb wait table-exists --table-name healthtrack-indisponibilites --region "$REGION"
echo "✅ Table healthtrack-indisponibilites créée"

# =============================================================================
# 8. Table RendezVous
# =============================================================================
echo "📋 [8/12] Création de la table RendezVous..."
aws dynamodb create-table \
  --table-name healthtrack-rendezvous \
  --attribute-definitions \
    AttributeName=rdvId,AttributeType=S \
    AttributeName=praticienId,AttributeType=S \
    AttributeName=patientId,AttributeType=S \
    AttributeName=date,AttributeType=S \
    AttributeName=statut,AttributeType=S \
  --key-schema \
    AttributeName=rdvId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "byPraticienAndDate",
        "KeySchema": [
          {"AttributeName": "praticienId", "KeyType": "HASH"},
          {"AttributeName": "date", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byPatientAndDate",
        "KeySchema": [
          {"AttributeName": "patientId", "KeyType": "HASH"},
          {"AttributeName": "date", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byStatut",
        "KeySchema": [
          {"AttributeName": "statut", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

aws dynamodb wait table-exists --table-name healthtrack-rendezvous --region "$REGION"
echo "✅ Table healthtrack-rendezvous créée"

# =============================================================================
# 9. Table ComptesRendus
# =============================================================================
echo "📋 [9/12] Création de la table ComptesRendus..."
aws dynamodb create-table \
  --table-name healthtrack-comptes-rendus \
  --attribute-definitions \
    AttributeName=compteRenduId,AttributeType=S \
    AttributeName=rdvId,AttributeType=S \
    AttributeName=praticienId,AttributeType=S \
    AttributeName=patientId,AttributeType=S \
  --key-schema \
    AttributeName=compteRenduId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "byRdv",
        "KeySchema": [
          {"AttributeName": "rdvId", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byPraticien",
        "KeySchema": [
          {"AttributeName": "praticienId", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byPatient",
        "KeySchema": [
          {"AttributeName": "patientId", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

aws dynamodb wait table-exists --table-name healthtrack-comptes-rendus --region "$REGION"
echo "✅ Table healthtrack-comptes-rendus créée"

# =============================================================================
# 10. Table Ordonnances
# =============================================================================
echo "📋 [10/12] Création de la table Ordonnances..."
aws dynamodb create-table \
  --table-name healthtrack-ordonnances \
  --attribute-definitions \
    AttributeName=ordonnanceId,AttributeType=S \
    AttributeName=compteRenduId,AttributeType=S \
    AttributeName=patientId,AttributeType=S \
    AttributeName=dateEmission,AttributeType=S \
    AttributeName=dateValidite,AttributeType=S \
    AttributeName=statut,AttributeType=S \
  --key-schema \
    AttributeName=ordonnanceId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "byCompteRendu",
        "KeySchema": [
          {"AttributeName": "compteRenduId", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byPatientAndDate",
        "KeySchema": [
          {"AttributeName": "patientId", "KeyType": "HASH"},
          {"AttributeName": "dateEmission", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byRendezVous",
        "KeySchema": [
          {"AttributeName": "rdvId", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "byStatut",
        "KeySchema": [
          {"AttributeName": "statut", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

aws dynamodb wait table-exists --table-name healthtrack-ordonnances --region "$REGION"
echo "✅ Table healthtrack-ordonnances créée"

# =============================================================================
# 11. Table LignesPrescription
# =============================================================================
echo "📋 [11/12] Création de la table LignesPrescription..."
aws dynamodb create-table \
  --table-name healthtrack-lignes-prescription \
  --attribute-definitions \
    AttributeName=ordonnanceId,AttributeType=S \
    AttributeName=ligneId,AttributeType=S \
  --key-schema \
    AttributeName=ordonnanceId,KeyType=HASH \
    AttributeName=ligneId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

aws dynamodb wait table-exists --table-name healthtrack-lignes-prescription --region "$REGION"
echo "✅ Table healthtrack-lignes-prescription créée"

# =============================================================================
# 12. Table Medicaments
# =============================================================================
echo "📋 [12/12] Création de la table Medicaments..."
aws dynamodb create-table \
  --table-name healthtrack-medicaments \
  --attribute-definitions \
    AttributeName=medicamentId,AttributeType=S \
    AttributeName=forme,AttributeType=S \
    AttributeName=substanceActive,AttributeType=S \
  --key-schema \
    AttributeName=medicamentId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "byForme",
        "KeySchema": [
          {"AttributeName": "forme", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      },
      {
        "IndexName": "bySubstanceActive",
        "KeySchema": [
          {"AttributeName": "substanceActive", "KeyType": "HASH"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

aws dynamodb wait table-exists --table-name healthtrack-medicaments --region "$REGION"
echo "✅ Table healthtrack-medicaments créée"

# =============================================================================
echo ""
echo "✅ Toutes les tables DynamoDB ont été créées !"
echo ""
echo "📋 Liste des tables :"
aws dynamodb list-tables --region "$REGION" | jq -r '.TableNames[] | select(. | startswith("healthtrack"))'
