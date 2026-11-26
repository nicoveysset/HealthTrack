# API Utilisateurs — HealthTrack

Inscription et connexion (émission des JWT), profils, médecin traitant, statut et recherche des praticiens.
Lambda `healthtrack-api-utilisateurs`, handler `com.healthtrack.utilisateurs.LambdaHandler`, port local `8081`.

Documentation complète (exemples et cas d'erreur) : Swagger UI sur `/swagger-ui.html`, contrat
[docs/openapi-utilisateurs.yaml](../docs/openapi-utilisateurs.yaml). Déploiement et lancement : [README principal](../README.md).

## Routes

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Inscription patient ou praticien → `201` + `{ user, token }` |
| POST | `/auth/login` | public | Connexion → `{ user, token }` |
| GET | `/utilisateurs/me` | connecté | Mon profil |
| PATCH | `/utilisateurs/me` | connecté | Modifier mon profil |
| GET | `/utilisateurs/{id}` | connecté | Profil d'un utilisateur (un patient n'est visible que par les praticiens) |
| PUT | `/patients/me/medecin-traitant` | patient | Désigner / modifier son médecin traitant |
| PATCH | `/praticiens/me/statut` | praticien | Passer ACTIF / EN_CONGE / INACTIF |
| GET | `/praticiens?specialite&statut&page&limit` | connecté | Recherche paginée de praticiens |

## Règles métier

| Situation | Exception | HTTP |
|---|---|---|
| Email déjà utilisé | `EmailAlreadyUsedException` | 409 |
| Médecin traitant non généraliste | `InvalidSpecialityException` | 422 |
| Médecin traitant INACTIF (EN_CONGE accepté) | `PractitionerNotAvailableException` | 409 |
| Mauvais identifiants | `InvalidCredentialsException` | 401 |
| Spécialité, statut, date ou pagination invalide | `ValidationException` | 400 |

Spécialités : `GENERALISTE`, `CARDIOLOGUE`, `DERMATOLOGUE`, `PEDIATRE`, `AUTRE`.

## Token JWT

Signé en HS256 avec `JWT_SECRET` (variable d'environnement, 32 caractères minimum, sans valeur par défaut),
valable 24 h. Claims : `sub` (userId), `email`, `type` (`PATIENT` / `PRATICIEN`), `name`.
Les trois autres APIs vérifient ce token avec le même secret.

## Données

Table `healthtrack-utilisateurs` (clé `userId`, GSI `byEmail`). Mots de passe hachés avec BCrypt.
Le praticien est créé au statut `ACTIF`.
