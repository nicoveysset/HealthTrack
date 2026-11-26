#!/usr/bin/env bash
# =============================================================================
# HealthTrack — Test de bout en bout des règles métier du sujet
#
# Vérifie, pour chaque règle, le code HTTP ET le nom de l'exception renvoyée.
# Utilisable en local (par défaut : APIs sur localhost:8081..8084) ou sur AWS :
#   source ../.env.apigateway && \
#   U=$UTILISATEURS_API_URL R=$RDV_API_URL D=$DOSSIERS_API_URL O=$ORDONNANCES_API_URL ./test-regles-metier.sh
#
# Le script crée ses propres comptes de test (emails uniques) : il ne touche pas aux données de démo.
# Le test "ordonnance EXPIREE" nécessite un accès direct à DynamoDB (variable DYNAMO_ENDPOINT, local uniquement).
# =============================================================================
set -uo pipefail

U="${U:-http://localhost:8081}"
R="${R:-http://localhost:8082}"
D="${D:-http://localhost:8083}"
O="${O:-http://localhost:8084}"
PWD_TEST="Test1234!"
RUN="$(date +%s)"

PASS=0; FAIL=0; CODE=""; BODY_OUT=""
GREEN='\033[0;32m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'

# call METHOD URL [TOKEN] [BODY] -> écrit le corps dans $BODY_OUT et le code dans $CODE
call() {
  local method="$1" url="$2" token="${3:-}" body="${4:-}"
  local args=(-s -o /tmp/ht_body.$$ -w '%{http_code}' -X "$method" "$url" -H 'Content-Type: application/json')
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(-d "$body")
  CODE=$(curl "${args[@]}")
  BODY_OUT=$(cat /tmp/ht_body.$$)
}

# expect DESCRIPTION CODE_ATTENDU [ERREUR_ATTENDUE]
expect() {
  local desc="$1" code="$2" err="${3:-}"
  local got_err
  got_err=$(echo "$BODY_OUT" | jq -r '.error // empty' 2>/dev/null)
  if [[ "$CODE" == "$code" && ( -z "$err" || "$got_err" == "$err" ) ]]; then
    PASS=$((PASS+1)); echo -e "  ${GREEN}✔${NC} $desc → $CODE ${got_err}"
  else
    FAIL=$((FAIL+1)); echo -e "  ${RED}✘ $desc${NC} → attendu $code ${err}, obtenu $CODE ${got_err}"
    echo "      $(echo "$BODY_OUT" | head -c 300)"
  fi
}

register() { # email type extra_json -> token
  call POST "$U/auth/register" "" "$(jq -nc --arg e "$1" --arg t "$2" --arg p "$PWD_TEST" --argjson x "$3" \
    '{email:$e,password:$p,type:$t,firstName:"Test",lastName:$t} + $x')"
  :
}

section() { echo -e "\n${BOLD}$1${NC}"; }

# Dates : prochain lundi (toujours dans le futur) et lendemain
LUNDI=$(date -d "next monday" +%F)
MARDI=$(date -d "$LUNDI + 1 day" +%F)
HIER=$(date -d "yesterday" +%F)

# =============================================================================
section "API Utilisateurs"
# =============================================================================
register "gen.$RUN@test.fr" PRATICIEN '{"specialite":"GENERALISTE","rpps":"10000000001"}'; R1="$BODY_OUT"
TOK_GEN=$(echo "$R1" | jq -r .token); ID_GEN=$(echo "$R1" | jq -r .user.userId)
expect "Inscription praticien généraliste" 201

register "cardio.$RUN@test.fr" PRATICIEN '{"specialite":"CARDIOLOGUE","rpps":"10000000002"}'; R1="$BODY_OUT"
TOK_CARDIO=$(echo "$R1" | jq -r .token); ID_CARDIO=$(echo "$R1" | jq -r .user.userId)

register "inactif.$RUN@test.fr" PRATICIEN '{"specialite":"GENERALISTE","rpps":"10000000003"}'; R1="$BODY_OUT"
TOK_INACTIF=$(echo "$R1" | jq -r .token); ID_INACTIF=$(echo "$R1" | jq -r .user.userId)

register "conge.$RUN@test.fr" PRATICIEN '{"specialite":"GENERALISTE","rpps":"10000000004"}'; R1="$BODY_OUT"
TOK_CONGE=$(echo "$R1" | jq -r .token); ID_CONGE=$(echo "$R1" | jq -r .user.userId)

register "patient.$RUN@test.fr" PATIENT '{"dateNaissance":"1990-05-12","nss":"190057512345678"}'; R1="$BODY_OUT"
TOK_PAT=$(echo "$R1" | jq -r .token); ID_PAT=$(echo "$R1" | jq -r .user.userId)
expect "Inscription patient" 201

register "patient2.$RUN@test.fr" PATIENT '{"dateNaissance":"1985-01-01","nss":"185017512345678"}'; R1="$BODY_OUT"
TOK_PAT2=$(echo "$R1" | jq -r .token); ID_PAT2=$(echo "$R1" | jq -r .user.userId)

register "patient.$RUN@test.fr" PATIENT '{"dateNaissance":"1990-05-12","nss":"1"}' >/dev/null
expect "Email déjà utilisé" 409 EmailAlreadyUsedException

register "x.$RUN@test.fr" PRATICIEN '{"specialite":"PLOMBIER","rpps":"1"}' >/dev/null
expect "Spécialité hors liste" 400 ValidationException

call POST "$U/auth/login" "" "{\"email\":\"patient.$RUN@test.fr\",\"password\":\"mauvais\"}"
expect "Mauvais mot de passe" 401 InvalidCredentialsException

call GET "$U/utilisateurs/me"
expect "Sans token" 401 UnauthorizedException

call PATCH "$U/utilisateurs/me" "$TOK_PAT" '{"firstName":"Alice"}'
expect "Modification de son profil" 200

call PATCH "$U/praticiens/me/statut" "$TOK_INACTIF" '{"statut":"INACTIF"}'
expect "Praticien passe INACTIF" 200
call PATCH "$U/praticiens/me/statut" "$TOK_CONGE" '{"statut":"EN_CONGE"}'
expect "Praticien passe EN_CONGE" 200
call PATCH "$U/praticiens/me/statut" "$TOK_PAT" '{"statut":"EN_CONGE"}'
expect "Un patient ne peut pas changer de statut" 403 ForbiddenException

call PUT "$U/patients/me/medecin-traitant" "$TOK_PAT" "{\"medecinTraitantId\":\"$ID_CARDIO\"}"
expect "Médecin traitant non généraliste" 422 InvalidSpecialityException
call PUT "$U/patients/me/medecin-traitant" "$TOK_PAT" "{\"medecinTraitantId\":\"$ID_INACTIF\"}"
expect "Médecin traitant INACTIF" 409 PractitionerNotAvailableException
call PUT "$U/patients/me/medecin-traitant" "$TOK_PAT" "{\"medecinTraitantId\":\"$ID_GEN\"}"
expect "Désignation d'un généraliste actif" 200

call GET "$U/praticiens?specialite=GENERALISTE&statut=ACTIF&page=1&limit=2" "$TOK_PAT"
expect "Recherche praticiens filtrée + paginée" 200
[[ $(echo "$BODY_OUT" | jq '.items | length') -le 2 ]] && echo "      (page de $(echo "$BODY_OUT" | jq '.items|length') / total $(echo "$BODY_OUT" | jq .count))"
call GET "$U/praticiens?limit=500" "$TOK_PAT"
expect "limit hors bornes" 400 ValidationException

# =============================================================================
section "API Disponibilités et Rendez-vous"
# =============================================================================
call PUT "$R/praticiens/me/disponibilites" "$TOK_GEN" '{"disponibilites":[{"jourSemaine":"LUNDI","heureDebut":"09:00","heureFin":"12:00"},{"jourSemaine":"LUNDI","heureDebut":"11:00","heureFin":"13:00"}]}'
expect "Disponibilités qui se chevauchent" 409 SlotOverlapException

ALL_DAYS=$(jq -nc '[ "LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI","DIMANCHE" ] | map({jourSemaine:., heureDebut:"00:00", heureFin:"23:59"}) | {disponibilites:.}')
call PUT "$R/praticiens/me/disponibilites" "$TOK_GEN" "$ALL_DAYS"
expect "Définition des disponibilités hebdomadaires" 200
for t in "$TOK_CONGE" "$TOK_INACTIF"; do call PUT "$R/praticiens/me/disponibilites" "$t" "$ALL_DAYS"; done

call POST "$R/praticiens/me/indisponibilites" "$TOK_GEN" "{\"dateDebut\":\"${MARDI}T14:00\",\"dateFin\":\"${MARDI}T16:00\",\"motif\":\"Formation\"}"
expect "Déclaration d'une indisponibilité ponctuelle" 201
INDISPO_ID=$(echo "$BODY_OUT" | jq -r .indispoId)

call GET "$R/praticiens/$ID_GEN/creneaux?dateDebut=$MARDI&dateFin=$MARDI" "$TOK_PAT"
expect "Créneaux disponibles sur une période" 200
echo "      14:00 proposé pendant l'indisponibilité ? $(echo "$BODY_OUT" | jq '[.[] | select(.heure=="14:00")] | length') (attendu 0)"

call POST "$R/rendezvous" "$TOK_PAT" "{\"praticienId\":\"$ID_GEN\",\"date\":\"$MARDI\",\"heure\":\"14:30\"}"
expect "RDV pendant une indisponibilité" 409 PractitionerUnavailableException

call POST "$R/rendezvous" "$TOK_PAT" "{\"praticienId\":\"$ID_GEN\",\"date\":\"$HIER\",\"heure\":\"10:00\"}"
expect "RDV dans le passé" 422 PastDateException

call POST "$R/rendezvous" "$TOK_PAT" "{\"praticienId\":\"$ID_CONGE\",\"date\":\"$LUNDI\",\"heure\":\"10:00\"}"
expect "RDV avec un praticien EN_CONGE" 409 PractitionerNotAvailableException
call POST "$R/rendezvous" "$TOK_PAT" "{\"praticienId\":\"$ID_INACTIF\",\"date\":\"$LUNDI\",\"heure\":\"10:00\"}"
expect "RDV avec un praticien INACTIF" 409 PractitionerNotAvailableException
call POST "$R/rendezvous" "$TOK_CONGE" "{\"praticienId\":\"$ID_CONGE\",\"patientId\":\"$ID_PAT\",\"date\":\"$LUNDI\",\"heure\":\"10:00\"}"
expect "Praticien EN_CONGE tente de créer un RDV" 409 PractitionerNotAvailableException

call POST "$R/rendezvous" "$TOK_PAT" "{\"praticienId\":\"$ID_GEN\",\"date\":\"$LUNDI\",\"heure\":\"10:00\",\"motif\":\"Consultation\"}"
expect "Prise de RDV" 201
RDV1=$(echo "$BODY_OUT" | jq -r .rdvId)

call POST "$R/rendezvous" "$TOK_PAT2" "{\"praticienId\":\"$ID_GEN\",\"date\":\"$LUNDI\",\"heure\":\"10:15\"}"
expect "Créneau déjà occupé" 409 SlotAlreadyTakenException

call POST "$R/rendezvous" "$TOK_PAT" "{\"praticienId\":\"$ID_GEN\",\"date\":\"2026-13-45\",\"heure\":\"10:00\"}"
expect "Date invalide (pas de 500)" 400 ValidationException

call GET "$R/rendezvous?statut=PLANIFIE&dateDebut=$LUNDI&dateFin=$LUNDI&page=1&limit=5" "$TOK_PAT"
expect "Liste paginée filtrée statut + date" 200
call GET "$R/rendezvous?statut=XYZ" "$TOK_PAT"
expect "Filtre statut invalide" 400 ValidationException

call PATCH "$R/rendezvous/$RDV1" "$TOK_PAT" '{"statut":"EN_COURS"}'
expect "Patient tente de passer le RDV EN_COURS" 403 ForbiddenException
call PATCH "$R/rendezvous/$RDV1" "$TOK_GEN" '{"statut":"TERMINE"}'
expect "Transition PLANIFIE → TERMINE interdite" 409 InvalidStatusTransitionException
call PATCH "$R/rendezvous/$RDV1" "$TOK_GEN" '{"statut":"CONFIRME"}'
expect "Confirmation du RDV" 200

# Dossier inaccessible tant que la consultation n'a pas eu lieu
call GET "$D/patients/$ID_PAT/dossier" "$TOK_GEN"
expect "Dossier : praticien sans consultation antérieure" 403 AccessDeniedException
call GET "$D/patients/$ID_PAT/dossier" "$TOK_CARDIO"
expect "Dossier : praticien n'ayant jamais vu le patient" 403 AccessDeniedException

call POST "$R/rendezvous/$RDV1/compte-rendu" "$TOK_GEN" '{"contenu":"Consultation de contrôle, RAS."}'
expect "Compte rendu sur un RDV non TERMINE" 409 ConsultationNotFinalizedException

call PATCH "$R/rendezvous/$RDV1" "$TOK_GEN" '{"statut":"EN_COURS"}'
expect "RDV EN_COURS" 200
call PATCH "$R/rendezvous/$RDV1" "$TOK_GEN" '{"statut":"TERMINE"}'
expect "RDV TERMINE" 200

# Annulation moins de 2h avant : RDV dans ~1h (dispos 00:00-23:59 tous les jours)
SOON_TS=$(( ( $(date +%s) + 3600 ) / 1800 * 1800 + 1800 ))
SOON_DATE=$(TZ=Europe/Paris date -d "@$SOON_TS" +%F); SOON_H=$(TZ=Europe/Paris date -d "@$SOON_TS" +%H:%M)
if [[ "$SOON_H" < "23:00" && "$SOON_DATE" == "$(TZ=Europe/Paris date +%F)" ]]; then
  call POST "$R/rendezvous" "$TOK_PAT2" "{\"praticienId\":\"$ID_GEN\",\"date\":\"$SOON_DATE\",\"heure\":\"$SOON_H\"}"
  RDV_SOON=$(echo "$BODY_OUT" | jq -r .rdvId)
  call PATCH "$R/rendezvous/$RDV_SOON" "$TOK_PAT2" '{"statut":"ANNULE"}'
  expect "Annulation moins de 2h avant ($SOON_H)" 409 CancellationTooLateException
else
  echo "  (test annulation < 2h ignoré : trop proche de minuit)"
fi
call POST "$R/rendezvous" "$TOK_PAT2" "{\"praticienId\":\"$ID_GEN\",\"date\":\"$MARDI\",\"heure\":\"09:00\"}"
RDV_ANNUL=$(echo "$BODY_OUT" | jq -r .rdvId)
call PATCH "$R/rendezvous/$RDV_ANNUL" "$TOK_PAT2" '{"statut":"ANNULE"}'
expect "Annulation plus de 2h avant" 200

call DELETE "$R/praticiens/me/indisponibilites/$INDISPO_ID" "$TOK_CARDIO"
expect "Supprimer l'indisponibilité d'un autre praticien" 403 ForbiddenException
call DELETE "$R/praticiens/me/indisponibilites/$INDISPO_ID" "$TOK_GEN"
expect "Supprimer sa propre indisponibilité" 204

# Compte rendu : brouillon puis finalisation
call POST "$R/rendezvous/$RDV1/compte-rendu" "$TOK_GEN" '{"contenu":"Patiente vue pour contrôle annuel.","diagnostic":"RAS"}'
expect "Rédaction du compte rendu (brouillon)" 201
call PUT "$R/rendezvous/$RDV1/compte-rendu" "$TOK_GEN" '{"contenu":"Patiente vue pour contrôle annuel. Tension normale.","diagnostic":"RAS"}'
expect "Modification du brouillon" 200

# =============================================================================
section "API Ordonnances (avant finalisation)"
# =============================================================================
call POST "$O/ordonnances" "$TOK_GEN" "{\"rdvId\":\"$RDV_ANNUL\"}"
expect "Ordonnance sur un RDV non TERMINE (ANNULE)" 409 ConsultationNotFinalizedException
call POST "$O/ordonnances" "$TOK_GEN" "{\"rdvId\":\"$RDV1\"}"
expect "Ordonnance avec compte rendu non finalisé" 409 ConsultationNotFinalizedException

call POST "$R/rendezvous/$RDV1/compte-rendu/finalisation" "$TOK_GEN"
expect "Finalisation du compte rendu" 200
call PUT "$R/rendezvous/$RDV1/compte-rendu" "$TOK_GEN" '{"contenu":"Tentative de modification après finalisation"}'
expect "Modifier un compte rendu finalisé" 409 CompteRenduAlreadyFinalizedException

# =============================================================================
section "API Dossiers Médicaux"
# =============================================================================
call GET "$D/patients/$ID_PAT/dossier" "$TOK_GEN"
expect "Dossier : praticien après consultation" 200
call GET "$D/patients/$ID_PAT/dossier" "$TOK_PAT2"
expect "Dossier d'un autre patient" 403 ForbiddenException

call PATCH "$D/patients/$ID_PAT/dossier" "$TOK_PAT" '{"groupeSanguin":"A+"}'
expect "Modification du groupe sanguin" 200

call POST "$D/patients/$ID_PAT/antecedents" "$TOK_GEN" '{"libelle":"Diabète de type 2","type":"CHRONIQUE","date":"2020-03-01"}'
expect "Ajout antécédent CHRONIQUE" 201
ANT_CHRO=$(echo "$BODY_OUT" | jq -r .antecedentId)
call POST "$D/patients/$ID_PAT/antecedents" "$TOK_PAT" '{"libelle":"Fracture du poignet","type":"PONCTUEL","date":"2018-07-14"}'
expect "Ajout antécédent PONCTUEL" 201
ANT_PONC=$(echo "$BODY_OUT" | jq -r .antecedentId)
call PATCH "$D/antecedents/$ANT_PONC" "$TOK_GEN" '{"description":"Poignet gauche, plâtre 6 semaines"}'
expect "Modification d'un antécédent" 200
call PATCH "$D/antecedents/$ANT_CHRO" "$TOK_GEN" '{"statut":"ARCHIVE"}'
expect "Archivage d'un antécédent CHRONIQUE" 409 ChronicConditionCannotBeArchivedException
call PATCH "$D/antecedents/$ANT_PONC" "$TOK_GEN" '{"statut":"ARCHIVE"}'
expect "Archivage d'un antécédent PONCTUEL" 200
call POST "$D/patients/$ID_PAT/antecedents" "$TOK_PAT" '{"libelle":"X","type":"AUTRE"}'
expect "Type d'antécédent invalide" 400 ValidationException

call POST "$D/patients/$ID_PAT/allergies" "$TOK_GEN" '{"medicamentConcerne":"Amoxicilline","severite":"SEVERE","dateDecouverte":"2015-02-10"}'
expect "Ajout allergie" 201
ALL_AMOX=$(echo "$BODY_OUT" | jq -r .allergieId)
call POST "$D/patients/$ID_PAT/allergies" "$TOK_PAT" '{"medicamentConcerne":"Ibuprofène","severite":"LEGERE"}'
ALL_IBU=$(echo "$BODY_OUT" | jq -r .allergieId)
call PATCH "$D/allergies/$ALL_IBU" "$TOK_GEN" '{"severite":"MODEREE"}'
expect "Modification d'une allergie (tracée CloudWatch)" 200
call GET "$D/patients/$ID_PAT/allergies" "$TOK_GEN"
expect "Liste des allergies du patient" 200

call POST "$D/patients/$ID_PAT/vaccinations" "$TOK_PAT" '{"nomVaccin":"DTP","date":"2024-01-15","rappelPrevu":"2044-01-15"}'
expect "Ajout vaccination" 201

# =============================================================================
section "API Ordonnances"
# =============================================================================
call GET "$O/medicaments?forme=COMPRIME&page=1&limit=50" "$TOK_GEN"
expect "Liste des médicaments (filtre forme)" 200
MED_AMOX=$(echo "$BODY_OUT" | jq -r '.items[] | select(.nom=="Amoxicilline") | .medicamentId' | head -1)
MED_DOLI=$(echo "$BODY_OUT" | jq -r '.items[] | select(.nom=="Doliprane") | .medicamentId' | head -1)
if [[ -z "$MED_AMOX" || -z "$MED_DOLI" ]]; then
  call POST "$O/medicaments" "$TOK_GEN" "{\"nom\":\"Amoxicilline $RUN\",\"substanceActive\":\"Amoxicilline\",\"forme\":\"COMPRIME\"}"
  MED_AMOX=$(echo "$BODY_OUT" | jq -r .medicamentId)
  call POST "$O/medicaments" "$TOK_GEN" "{\"nom\":\"Doliprane $RUN\",\"substanceActive\":\"Paracétamol\",\"forme\":\"COMPRIME\"}"
  MED_DOLI=$(echo "$BODY_OUT" | jq -r .medicamentId)
fi

call POST "$O/ordonnances" "$TOK_CARDIO" "{\"rdvId\":\"$RDV1\"}"
expect "Ordonnance par un praticien n'ayant pas réalisé la consultation" 403 ForbiddenException
call POST "$O/ordonnances" "$TOK_GEN" "{\"rdvId\":\"$RDV1\"}"
expect "Création de l'ordonnance" 201
ORD=$(echo "$BODY_OUT" | jq -r .ordonnanceId)
echo "      validité : $(echo "$BODY_OUT" | jq -r .dateValidite) (3 mois)"
call POST "$O/ordonnances" "$TOK_GEN" "{\"rdvId\":\"$RDV1\"}"
expect "Deuxième ordonnance sur le même RDV" 409 ConflictException

call POST "$O/ordonnances/$ORD/lignes" "$TOK_GEN" "{\"medicamentId\":\"$MED_AMOX\",\"posologie\":\"1 cp matin et soir\",\"duree\":7}"
expect "Médicament avec allergie connue" 409 AllergyConflictException
call POST "$O/ordonnances/$ORD/lignes" "$TOK_GEN" "{\"medicamentId\":\"$MED_DOLI\",\"posologie\":\"1 cp si douleur\",\"duree\":5}"
expect "Ajout d'une ligne" 201
LIGNE=$(echo "$BODY_OUT" | jq -r .ligneId)
call POST "$O/ordonnances/$ORD/lignes" "$TOK_GEN" "{\"medicamentId\":\"$MED_DOLI\",\"posologie\":\"1 cp le soir\",\"duree\":120}"
expect "Ligne > 90 jours (acceptée + alerte CloudWatch)" 201
call POST "$O/ordonnances/$ORD/lignes" "$TOK_GEN" "{\"medicamentId\":\"$MED_DOLI\",\"posologie\":\"x\",\"duree\":0}"
expect "Durée invalide" 400 ValidationException

call GET "$O/ordonnances?patientId=$ID_PAT" "$TOK_CARDIO"
expect "Ordonnances d'un patient jamais consulté" 403 AccessDeniedException
call GET "$O/ordonnances" "$TOK_PAT"
expect "Le patient consulte ses ordonnances" 200
call GET "$O/ordonnances/$ORD" "$TOK_PAT"
expect "Détail ordonnance + lignes" 200

call DELETE "$D/allergies/$ALL_IBU" "$TOK_PAT"
expect "Suppression d'une allergie non liée" 204
call POST "$D/patients/$ID_PAT/allergies" "$TOK_PAT" '{"medicamentConcerne":"Paracétamol","severite":"LEGERE"}'
ALL_PARA=$(echo "$BODY_OUT" | jq -r .allergieId)
call DELETE "$D/allergies/$ALL_PARA" "$TOK_PAT"
expect "Suppression d'une allergie liée à une ordonnance active" 409 AllergyLinkedToActivePrescriptionException

call DELETE "$O/ordonnances/$ORD/lignes/$LIGNE" "$TOK_GEN"
expect "Retrait d'une ligne" 204

if [[ -n "${DYNAMO_ENDPOINT:-}" ]]; then
  aws dynamodb update-item --endpoint-url "$DYNAMO_ENDPOINT" --table-name healthtrack-ordonnances \
    --key "{\"ordonnanceId\":{\"S\":\"$ORD\"}}" --update-expression "SET dateValidite = :d" \
    --expression-attribute-values '{":d":{"S":"2020-01-01T23:59:59"}}' >/dev/null
  call POST "$O/ordonnances/$ORD/lignes" "$TOK_GEN" "{\"medicamentId\":\"$MED_DOLI\",\"posologie\":\"1 cp\",\"duree\":3}"
  expect "Modification d'une ordonnance EXPIREE (ajout)" 409 PrescriptionExpiredException
  call DELETE "$O/ordonnances/$ORD/lignes/whatever" "$TOK_GEN"
  expect "Modification d'une ordonnance EXPIREE (retrait)" 409 PrescriptionExpiredException
fi

echo -e "\n${BOLD}Résultat : ${GREEN}$PASS réussis${NC}, ${RED}$FAIL échoués${NC}"
rm -f /tmp/ht_body.$$
[[ $FAIL -eq 0 ]]
