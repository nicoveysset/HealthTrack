# HealthTrack — Projet Maven / Spring Boot

Application de gestion de cabinet médical composée de **4 microservices Spring Boot** indépendants,
chacun avec sa propre base H2 embarquée, sa documentation Swagger et son authentification JWT.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (React/Vite)                   │
│                    frontend/  (inchangé)                      │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP + JWT (Bearer)
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ :8081       │   │ :8082        │   │ :8083        │   │ :8084        │
│ Utilisateurs│   │ Dispo/RDV    │   │ Dossiers     │   │ Ordonnances  │
│             │   │              │   │ Médicaux     │   │              │
│ H2 embarqué │   │ H2 embarqué  │   │ H2 embarqué  │   │ H2 embarqué  │
│ Swagger UI  │   │ Swagger UI   │   │ Swagger UI   │   │ Swagger UI   │
└─────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

## Prérequis

- **Java 21+** (JDK complet avec `javac`)
- **Maven 3.8+**

## Compilation

```bash
mvn clean compile
```

## Lancement d'un service

```bash
# API Utilisateurs (port 8081)
mvn spring-boot:run -pl api-utilisateurs

# API Disponibilités/RDV (port 8082)
mvn spring-boot:run -pl api-disponibilites-rdv

# API Dossiers Médicaux (port 8083)
mvn spring-boot:run -pl api-dossiers-medicaux

# API Ordonnances (port 8084)
mvn spring-boot:run -pl api-ordonnances
```

## Documentation Swagger (par service)

| Service | Swagger UI | API Docs |
|---------|-----------|----------|
| Utilisateurs | http://localhost:8081/swagger-ui.html | http://localhost:8081/v3/api-docs |
| Dispo/RDV | http://localhost:8082/swagger-ui.html | http://localhost:8082/v3/api-docs |
| Dossiers | http://localhost:8083/swagger-ui.html | http://localhost:8083/v3/api-docs |
| Ordonnances | http://localhost:8084/swagger-ui.html | http://localhost:8084/v3/api-docs |

## Authentification

1. `POST /auth/register` sur le port 8081 pour créer un compte → retourne un JWT
2. Utiliser ce JWT dans le header `Authorization: Bearer <token>` pour toutes les autres requêtes

## Structure du projet

```
HealthTrack-complet-local/
├── pom.xml                          # POM parent (multi-modules)
├── api-utilisateurs/                # Module 1 — Auth + profils (port 8081)
│   ├── pom.xml
│   └── src/main/java/com/healthtrack/utilisateurs/
│       ├── UtilisateursApplication.java
│       ├── controller/AuthController.java
│       ├── service/UserService.java
│       ├── repository/UserRepository.java
│       ├── model/                   # User, UserType, PraticienStatut
│       ├── dto/                     # RegisterRequest, LoginRequest, etc.
│       ├── config/                  # SecurityConfig, JwtService, JwtAuthFilter
│       └── exception/               # ApiException, GlobalExceptionHandler
├── api-disponibilites-rdv/          # Module 2 — Dispo, RDV, CR (port 8082)
├── api-dossiers-medicaux/           # Module 3 — Dossiers, antécédents, allergies (port 8083)
├── api-ordonnances/                 # Module 4 — Ordonnances, médicaments (port 8084)
├── frontend/                        # Frontend React (inchangé)
├── docs/                            # Contrats OpenAPI (inchangé)
└── infrastructure/                  # Scripts AWS CLI (inchangé)
```

## Endpoints par service

### API Utilisateurs (:8081)
- `POST /auth/register` — Inscription
- `POST /auth/login` — Connexion
- `GET /utilisateurs/me` — Profil
- `PATCH /utilisateurs/me` — Mise à jour profil
- `PUT /patients/me/medecin-traitant` — Désigner médecin traitant
- `PATCH /praticiens/me/statut` — Changer statut praticien
- `GET /praticiens` — Lister praticiens (filtré/paginé)

### API Disponibilités/RDV (:8082)
- `PUT/GET /praticiens/me/disponibilites` — Gérer disponibilités
- `GET /praticiens/{id}/disponibilites` — Voir dispo d'un praticien
- `POST/GET /praticiens/me/indisponibilites` — Indisponibilités
- `DELETE /indisponibilites/{id}` — Supprimer indispo
- `GET /praticiens/{id}/creneaux?dateDebut=&dateFin=` — Créneaux libres
- `POST /rendezvous` — Prendre RDV
- `GET /rendezvous` — Lister ses RDV
- `POST /rendezvous/{id}/confirmer|annuler|en-cours|termine|non-venu` — Transitions
- `POST/GET /rendezvous/{id}/compte-rendu` — Compte rendu

### API Dossiers Médicaux (:8083)
- `GET /patients/{id}/dossier` — Dossier complet
- `POST /dossiers/{id}/antecedents` — Créer antécédent
- `PATCH /antecedents/{id}` — Modifier antécédent
- `POST /antecedents/{id}/archiver` — Archiver
- `GET /patients/{id}/antecedents` — Lister antécédents
- `POST /dossiers/{id}/allergies` — Créer allergie
- `DELETE /allergies/{id}` — Supprimer allergie
- `GET /patients/{id}/allergies` — Lister allergies
- `POST /dossiers/{id}/vaccinations` — Créer vaccination
- `GET /patients/{id}/vaccinations` — Lister vaccinations

### API Ordonnances (:8084)
- `POST /ordonnances` — Créer ordonnance
- `GET /ordonnances/{id}` — Voir ordonnance + lignes
- `GET /ordonnances` — Lister ordonnances
- `POST /ordonnances/{id}/lignes` — Ajouter ligne
- `DELETE /ordonnances/{id}/lignes/{ligneId}` — Supprimer ligne
- `GET /ordonnances/{id}/lignes` — Lister lignes
- `GET /medicaments` — Lister médicaments
- `POST /medicaments` — Créer médicament

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `JWT_SECRET` | `healthtrack-default-secret-...` | Clé secrète pour signer les JWT (à changer en prod) |

## Base de données

Chaque service utilise une base **H2 en mémoire** (rien à configurer pour le dev).
Console H2 disponible sur `/h2-console` (ex: http://localhost:8081/h2-console).
