#!/usr/bin/env bash
# =============================================================================
# HealthTrack - Donnees de demonstration
# =============================================================================
# Remplit l'application deployee avec des donnees fictives, en passant par les
# APIs (pas d'ecriture directe dans DynamoDB) : les mots de passe sont hashes
# et les regles metier s'appliquent comme pour un vrai utilisateur.
#
# Cree :
#   - 4 praticiens (generaliste, cardiologue, dermatologue, pediatre)
#     avec des disponibilites du lundi au vendredi
#   - 1 praticien EN_CONGE (pour montrer PractitionerNotAvailableException)
#   - 2 patients
#   - un catalogue de medicaments
#
# Relancable sans risque : un compte deja existant est simplement reconnecte.
# Prerequis : deploy-apigateway.sh deja lance (fichier .env.apigateway).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PASSWORD="${SEED_PASSWORD:-Demo1234!}"

for command in curl jq; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

# ENV_FILE permet de cibler un autre environnement (ex. APIs lancées en local)
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env.apigateway}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Lancez deploy-apigateway.sh d'abord." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$ENV_FILE"

# --- Appel HTTP : affiche le corps, met le code HTTP dans HTTP_CODE ----------
call() {
  local method="$1" url="$2" token="${3:-}" body="${4:-}"
  local args=(-s -X "$method" "$url" -H "Content-Type: application/json" -w $'\n%{http_code}' --max-time 60)
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(-d "$body")
  local response
  response="$(curl "${args[@]}")"
  HTTP_CODE="${response##*$'\n'}"
  RESPONSE_BODY="${response%$'\n'*}"
}

# --- Cree le compte, ou se reconnecte s'il existe deja. Renvoie le token -----
get_token() {
  local payload="$1" email
  email="$(jq -r .email <<<"$payload")"
  call POST "$UTILISATEURS_API_URL/auth/register" "" "$payload"
  if [[ "$HTTP_CODE" == "201" ]]; then
    echo "  + compte cree : $email" >&2
  elif [[ "$HTTP_CODE" == "409" ]]; then
    call POST "$UTILISATEURS_API_URL/auth/login" "" \
      "$(jq -n --arg e "$email" --arg p "$PASSWORD" '{email:$e, password:$p}')"
    if [[ "$HTTP_CODE" != "200" ]]; then
      echo "  ! $email existe deja mais la connexion echoue ($HTTP_CODE) : $RESPONSE_BODY" >&2
      return 1
    fi
    echo "  = compte existant : $email" >&2
  else
    echo "  ! inscription de $email impossible ($HTTP_CODE) : $RESPONSE_BODY" >&2
    return 1
  fi
  jq -r .token <<<"$RESPONSE_BODY"
}

praticien_json() {
  jq -n --arg email "$1" --arg prenom "$2" --arg nom "$3" --arg spe "$4" --arg rpps "$5" --arg p "$PASSWORD" \
    '{email:$email, password:$p, type:"PRATICIEN", firstName:$prenom, lastName:$nom, specialite:$spe, rpps:$rpps}'
}

patient_json() {
  jq -n --arg email "$1" --arg prenom "$2" --arg nom "$3" --arg naissance "$4" --arg nss "$5" --arg p "$PASSWORD" \
    '{email:$email, password:$p, type:"PATIENT", firstName:$prenom, lastName:$nom, dateNaissance:$naissance, nss:$nss}'
}

# Disponibilites : lundi -> vendredi, 9h-12h et 14h-18h
DISPOS="$(jq -n '{disponibilites: [
  "LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI"
] | map({jourSemaine: ., heureDebut: "09:00", heureFin: "12:00"},
        {jourSemaine: ., heureDebut: "14:00", heureFin: "18:00"})}')"

set_dispos() {
  local token="$1" label="$2"
  call PUT "$RDV_API_URL/praticiens/me/disponibilites" "$token" "$DISPOS"
  if [[ "$HTTP_CODE" == "200" ]]; then
    echo "    disponibilites definies (lun-ven 9h-12h / 14h-18h) pour $label"
  else
    echo "    ! disponibilites de $label : $HTTP_CODE $RESPONSE_BODY" >&2
  fi
}

echo "Premier appel : les Lambdas peuvent mettre 10-20 s a demarrer..."
echo

echo "== Praticiens =="
T_MARTIN="$(get_token "$(praticien_json dr.martin@healthtrack.fr Claire Martin GENERALISTE 10000000001)")"
set_dispos "$T_MARTIN" "Dr Martin"
T_BERNARD="$(get_token "$(praticien_json dr.bernard@healthtrack.fr Paul Bernard CARDIOLOGUE 10000000002)")"
set_dispos "$T_BERNARD" "Dr Bernard"
T_PETIT="$(get_token "$(praticien_json dr.petit@healthtrack.fr Lea Petit DERMATOLOGUE 10000000003)")"
set_dispos "$T_PETIT" "Dr Petit"
T_DURAND="$(get_token "$(praticien_json dr.durand@healthtrack.fr Hugo Durand PEDIATRE 10000000004)")"
set_dispos "$T_DURAND" "Dr Durand"

T_LEROY="$(get_token "$(praticien_json dr.leroy@healthtrack.fr Marc Leroy GENERALISTE 10000000005)")"
set_dispos "$T_LEROY" "Dr Leroy"
call PATCH "$UTILISATEURS_API_URL/praticiens/me/statut" "$T_LEROY" '{"statut":"EN_CONGE"}'
if [[ "$HTTP_CODE" == "200" ]]; then
  echo "    Dr Leroy passe EN_CONGE (cas de test PractitionerNotAvailableException)"
else
  echo "    ! statut de Dr Leroy : $HTTP_CODE $RESPONSE_BODY" >&2
fi

echo
echo "== Patients =="
get_token "$(patient_json alice.dupont@example.com Alice Dupont 1990-04-12 2900475012345)" >/dev/null
get_token "$(patient_json karim.benali@example.com Karim Benali 1985-11-03 1851175098765)" >/dev/null

echo
echo "== Medicaments =="
add_medicament() {
  local body
  body="$(jq -n --arg nom "$1" --arg sub "$2" --arg forme "$3" --arg desc "$4" \
    '{nom:$nom, substanceActive:$sub, forme:$forme, description:$desc}')"
  call POST "$ORDONNANCES_API_URL/medicaments" "$T_MARTIN" "$body"
  case "$HTTP_CODE" in
    201) echo "  + $1" ;;
    409) echo "  = $1 (deja present)" ;;
    *)   echo "  ! $1 : $HTTP_CODE $RESPONSE_BODY" >&2 ;;
  esac
}
add_medicament "Doliprane 1000 mg"  "Paracetamol"            COMPRIME  "Antalgique et antipyretique"
add_medicament "Amoxicilline 500 mg" "Amoxicilline"          COMPRIME  "Antibiotique (penicilline)"
add_medicament "Ibuprofene 400 mg"  "Ibuprofene"             COMPRIME  "Anti-inflammatoire non steroidien"
add_medicament "Ventoline"          "Salbutamol"             AUTRE     "Bronchodilatateur en inhalation"
add_medicament "Toplexil"           "Oxomemazine"            SIROP     "Antitussif"
add_medicament "Augmentin"          "Amoxicilline + acide clavulanique" COMPRIME "Antibiotique"
add_medicament "Lovenox 4000 UI"    "Enoxaparine"            INJECTION "Anticoagulant"
add_medicament "Kardegic 75 mg"     "Acide acetylsalicylique" AUTRE    "Antiagregant plaquettaire"

echo
echo "================================================================"
echo " Donnees de demo pretes. Mot de passe de tous les comptes : $PASSWORD"
echo "----------------------------------------------------------------"
echo " Praticiens : dr.martin@healthtrack.fr   (generaliste)"
echo "              dr.bernard@healthtrack.fr  (cardiologue)"
echo "              dr.petit@healthtrack.fr    (dermatologue)"
echo "              dr.durand@healthtrack.fr   (pediatre)"
echo "              dr.leroy@healthtrack.fr    (generaliste, EN_CONGE)"
echo " Patients   : alice.dupont@example.com"
echo "              karim.benali@example.com"
echo "================================================================"
