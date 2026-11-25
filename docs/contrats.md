# Contrats API — HealthTrack

> **⚠️ DOCUMENT À FIGER EN J1 - TOUTE MODIFICATION DOIT ÊTRE ANNONCÉE AU GROUPE**

Ce document contient les contrats qui définissent l'interface entre les différentes parties du système.
**Aucun code ne doit être écrit sans respecter ces contrats.**

---

## 1. Schéma DynamoDB définitif

Les 12 tables suivantes doivent être créées avec les clés et GSIs exactement comme décrits.

### 1.1 `healthtrack-utilisateurs`

**Description** : Utilisateurs (patients + praticiens)

| Attribut | Type | Clé | GSI | Description |
|----------|------|-----|-----|-------------|
| `userId` | String | PK ✅ | - | Identifiant unique (UUID) |
| `email` | String | - | `byEmail` (HASH) | Adresse email (unique) |
| `passwordHash` | String | - | - | Hash BCrypt du mot de passe |
| `type` | String | - | - | `PRATICIEN` ou `PATIENT` (required) |
| `name` | String | - | - | Nom complet (optionnel) |
| `firstName` | String | - | - | Prénom (required) |
| `lastName` | String | - | - | Nom (required) |
| `createdAt` | String | - | - | Date de création (ISO) |
| `updatedAt` | String | - | - | Date de mise à jour (ISO) |
| `specialite` | String | - | - | Spécialité (praticien uniquement) |
| `rpps` | String | - | - | RPPS fictif (praticien uniquement) |
| `statut` | String | - | - | `ACTIF` / `EN_CONGE` / `INACTIF` (praticien uniquement) |
| `dateNaissance` | String | - | - | Date de naissance (ISO) (patient uniquement) |
| `nss` | String | - | - | NSS fictif (patient uniquement) |
| `medecinTraitantId` | String | - | `byMedecinTraitant` (HASH + `type` RANGE) | ID du médecin traitant (patient uniquement) |

**GSIs :**
- `byEmail` : PK=`email` → permet de trouver un utilisateur par email
- `byMedecinTraitant` : PK=`medecinTraitantId`, SK=`type` → permet de lister les patients par médecin traitant

---

### 1.2 `healthtrack-dossiers-medicaux`

**Description** : Dossiers médicaux des patients

| Attribut | Type | Clé | GSI | Description |
|----------|------|-----|-----|-------------|
| `patientId` | String | PK ✅ | - | ID du patient (même que `userId` dans Utilisateurs) |
| `groupeSanguin` | String | - | - | Groupe sanguin (optionnel) |
| `dateCreation` | String | - | - | Date de création (ISO) |
| `updatedAt` | String | - | - | Date de mise à jour (ISO) |

---

### 1.3 `healthtrack-antecedents`

**Description** : Antécédents médicaux

| Attribut | Type | Clé | GSI | Description |
|----------|------|-----|-----|-------------|
| `antecedentId` | String | PK ✅ | - | Identifiant unique (UUID) |
| `dossierId` | String | - | `byDossier` (HASH) | ID du dossier (même que `patientId`) |
| `libellé` | String | - | - | Libellé de l'antécédent |
| `type` | String | - | `byDossierAndType` (HASH + SK) | `CHRONIQUE` ou `PONCTUEL` |
| `date` | String | - | - | Date de l'antécédent (ISO) |
| `statut` | String | - | `byStatut` (HASH) | `ACTIF` ou `ARCHIVE` |
| `description` | String | - | - | Description détaillée |
| `createdAt` | String | - | - | Date de création (ISO) |
| `updatedAt` | String | - | - | Date de mise à jour (ISO) |

**GSIs :**
- `byDossier` : PK=`dossierId` → liste des antécédents d'un patient
- `byDossierAndType` : PK=`dossierId`, SK=`type` → liste des antécédents par type
- `byStatut` : PK=`statut` → liste des antécédents par statut

---

### 1.4 `healthtrack-allergies`

**Description** : Allergies des patients

| Attribut | Type | Clé | GSI | Description |
|----------|------|-----|-----|-------------|
| `allergieId` | String | PK ✅ | - | Identifiant unique (UUID) |
| `patientId` | String | - | `byPatient` (HASH) | ID du patient |
| `médicamentConcerne` | String | - | - | Nom du médicament concerné |
| `sévérité` | String | - | - | `LEGERE` / `MODEREE` / `SEVERE` |
| `dateDécouverte` | String | - | - | Date de découverte (ISO) |
| `description` | String | - | - | Description |
| `createdAt` | String | - | - | Date de création (ISO) |
| `updatedAt` | String | - | - | Date de mise à jour (ISO) |

**GSIs :**
- `byPatient` : PK=`patientId` → liste des allergies d'un patient

---

### 1.5 `healthtrack-vaccinations`

**Description** : Vaccinations des patients

| Attribut | Type | Clé | GSI | Description |
|----------|------|-----|-----|-------------|
| `vaccinationId` | String | PK ✅ | - | Identifiant unique (UUID) |
| `dossierId` | String | - | `byDossier` (HASH) | ID du dossier (même que `patientId`) |
| `nomVaccin` | String | - | `byDossierAndNom` (HASH + SK) | Nom du vaccin |
| `date` | String | - | - | Date de vaccination (ISO) |
| `rappelPrévu` | String | - | - | Date du prochain rappel (ISO) |
| `description` | String | - | - | Description |
| `createdAt` | String | - | - | Date de création (ISO) |
| `updatedAt` | String | - | - | Date de mise à jour (ISO) |

**GSIs :**
- `byDossier` : PK=`dossierId` → liste des vaccinations d'un patient
- `byDossierAndNom` : PK=`dossierId`, SK=`nomVaccin` → liste des vaccinations par nom

---

### 1.6 `healthtrack-disponibilites`

**Description** : Disponibilités hebdomadaires des praticiens

| Attribut | Type | Clé | GSI | Description |
|----------|------|-----|-----|-------------|
| `dispoId` | String | PK ✅ | - | Identifiant unique (UUID) |
| `praticienId` | String | - | `byPraticien` (HASH) / `byPraticienAndJour` (HASH) | ID du praticien |
| `jourSemaine` | String | - | `byPraticienAndJour` (SK) | `LUNDI`, `MARDI`, `MERCREDI`, `JEUDI`, `VENDREDI`, `SAMEDI`, `DIMANCHE` |
| `heureDebut` | String | - | - | Heure de début (format `HH:MM`) |
| `heureFin` | String | - | - | Heure de fin (format `HH:MM`) |
| `récurrente` | Boolean | - | - | Toujours `true` pour les disponibilités hebdomadaires |
| `createdAt` | String | - | - | Date de création (ISO) |
| `updatedAt` | String | - | - | Date de mise à jour (ISO) |

**GSIs :**
- `byPraticien` : PK=`praticienId` → liste des disponibilités d'un praticien
- `byPraticienAndJour` : PK=`praticienId`, SK=`jourSemaine` → disponibilités pour un jour spécifique

---

### 1.7 `healthtrack-indisponibilites`

**Description** : Indisponibilités ponctuelles des praticiens

| Attribut | Type | Clé | GSI | Description |
|----------|------|-----|-----|-------------|
| `indispoId` | String | PK ✅ | - | Identifiant unique (UUID) |
| `praticienId` | String | - | `byPraticien` (HASH) / `byPraticienAndDate` (HASH) | ID du praticien |
| `dateDebut` | String | - | `byPraticienAndDate` (SK) | Date de début (ISO) |
| `dateFin` | String | - | - | Date de fin (ISO) |
| `motif` | String | - | - | Motif de l'indisponibilité |
| `récurrente` | Boolean | - | - | Toujours `false` pour les indisponibilités ponctuelles |
| `createdAt` | String | - | - | Date de création (ISO) |
| `updatedAt` | String | - | - | Date de mise à jour (ISO) |

**GSIs :**
- `byPraticien` : PK=`praticienId` → liste des indisponibilités d'un praticien
- `byPraticienAndDate` : PK=`praticienId`, SK=`dateDebut` → indisponibilités pour une date spécifique

---

### 1.8 `healthtrack-rendezvous`

**Description** : Rendez-vous

| Attribut | Type | Clé | GSI | Description |
|----------|------|-----|-----|-------------|
| `rdvId` | String | PK ✅ | - | Identifiant unique (UUID) |
| `praticienId` | String | - | `byPraticienAndDate` (HASH + SK) | ID du praticien |
| `patientId` | String | - | `byPatientAndDate` (HASH + SK) | ID du patient |
| `date` | String | - | `byPraticienAndDate` (SK) / `byPatientAndDate` (SK) | Date du RDV (format `YYYY-MM-DD`) |
| `heure` | String | - | - | Heure du RDV (format `HH:MM`) |
| `duree` | Number | - | - | Durée en minutes (default: 30) |
| `statut` | String | - | `byStatut` (HASH) | `PLANIFIE` / `CONFIRME` / `EN_COURS` / `TERMINE` / `ANNULE` / `NON_VENU` |
| `createdAt` | String | - | - | Date de création (ISO) |
| `updatedAt` | String | - | - | Date de mise à jour (ISO) |

**GSIs :**
- `byPraticienAndDate` : PK=`praticienId`, SK=`date` → RDVs d'un praticien pour une date
- `byPatientAndDate` : PK=`patientId`, SK=`date` → RDVs d'un patient pour une date
- `byStatut` : PK=`statut` → RDVs par statut

---

### 1.9 `healthtrack-comptes-rendus`

**Description** : Comptes rendus de consultation

| Attribut | Type | Clé | GSI | Description |
|----------|------|-----|-----|-------------|
| `compteRenduId` | String | PK ✅ | - | Identifiant unique (UUID) |
| `rdvId` | String | - | `byRdv` (HASH) | ID du rendez-vous |
| `praticienId` | String | - | `byPraticien` (HASH) | ID du praticien |
| `patientId` | String | - | `byPatient` (HASH) | ID du patient |
| `contenu` | String | - | - | Contenu du compte rendu (texte) |
| `dateFinalisation` | String | - | - | Date de finalisation (ISO) |
| `createdAt` | String | - | - | Date de création (ISO) |
| `updatedAt` | String | - | - | Date de mise à jour (ISO) |

**GSIs :**
- `byRdv` : PK=`rdvId` → compte rendu pour un RDV
- `byPraticien` : PK=`praticienId` → comptes rendus d'un praticien
- `byPatient` : PK=`patientId` → comptes rendus d'un patient

---

### 1.10 `healthtrack-ordonnances`

**Description** : Ordonnances

| Attribut | Type | Clé | GSI | Description |
|----------|------|-----|-----|-------------|
| `ordonnanceId` | String | PK ✅ | - | Identifiant unique (UUID) |
| `compteRenduId` | String | - | `byCompteRendu` (HASH) | ID du compte rendu |
| `patientId` | String | - | `byPatientAndDate` (HASH + SK) | ID du patient |
| `rdvId` | String | - | `byRendezVous` (HASH) | ID du rendez-vous |
| `praticienId` | String | - | - | ID du praticien |
| `dateEmission` | String | - | `byPatientAndDate` (SK) | Date d'émission (ISO) |
| `dateValidite` | String | - | - | Date de validité (ISO, default: +3 mois) |
| `statut` | String | - | `byStatut` (HASH) | `ACTIVE` / `EXPIREE` |
| `createdAt` | String | - | - | Date de création (ISO) |
| `updatedAt` | String | - | - | Date de mise à jour (ISO) |

**GSIs :**
- `byCompteRendu` : PK=`compteRenduId` → ordonnances pour un compte rendu
- `byPatientAndDate` : PK=`patientId`, SK=`dateEmission` → ordonnances d'un patient
- `byRendezVous` : PK=`rdvId` → ordonnance pour un RDV
- `byStatut` : PK=`statut` → ordonnances par statut

---

### 1.11 `healthtrack-lignes-prescription`

**Description** : Lignes de prescription (composite key)

| Attribut | Type | Clé | GSI | Description |
|----------|------|-----|-----|-------------|
| `ordonnanceId` | String | PK ✅ | - | ID de l'ordonnance |
| `ligneId` | String | SK ✅ | - | Identifiant de la ligne (UUID) |
| `medicamentId` | String | - | - | ID du médicament |
| `posologie` | String | - | - | Posologie (ex: "1 comprimé 2x/jour") |
| `duree` | Number | - | - | Durée en jours |
| `instructions` | String | - | - | Instructions supplémentaires |
| `createdAt` | String | - | - | Date de création (ISO) |
| `updatedAt` | String | - | - | Date de mise à jour (ISO) |

**Clé composite** : PK=`ordonnanceId`, SK=`ligneId` → permet d'avoir plusieurs lignes par ordonnance

---

### 1.12 `healthtrack-medicaments`

**Description** : Médicaments

| Attribut | Type | Clé | GSI | Description |
|----------|------|-----|-----|-------------|
| `medicamentId` | String | PK ✅ | - | Identifiant unique (UUID) |
| `nom` | String | - | - | Nom commercial |
| `substanceActive` | String | - | `bySubstanceActive` (HASH) | Substance active |
| `forme` | String | - | `byForme` (HASH) | `COMPRIME` / `SIROP` / `INJECTION` / `AUTRE` |
| `description` | String | - | - | Description |
| `createdAt` | String | - | - | Date de création (ISO) |
| `updatedAt` | String | - | - | Date de mise à jour (ISO) |

**GSIs :**
- `byForme` : PK=`forme` → médicaments par forme
- `bySubstanceActive` : PK=`substanceActive` → médicaments par substance active

---

## 2. Format d'erreur uniforme

**Tous les endpoints doivent retourner des erreurs au format suivant :**

```json
{
  "error": "NomDeLException",
  "message": "Description humaine de l'erreur",
  "statusCode": 400
}
```

### 2.1 Codes HTTP

| Code | Utilisation | Exemples |
|------|-------------|-----------|
| **200** | Succès | GET /utilisateurs/me |
| **201** | Ressource créée | POST /auth/register, POST /rendezvous |
| **204** | Succès sans contenu | DELETE /allergies/{id} |
| **400** | **Erreur de validation d'entrée** | Email invalide, password trop court |
| **401** | **Non authentifié** | Token JWT manquant/invalide |
| **403** | **Non autorisé** | Rôle incorrect, accès refusé |
| **404** | **Ressource non trouvée** | Utilisateur non trouvé |
| **409** | **Conflit métier** | Email déjà utilisé, créneau occupé |
| **500** | **Erreur interne** | Erreur serveur |

### 2.2 Exceptions nommées

**API Utilisateurs :**
- `ValidationError` (400)
- `EmailAlreadyUsedException` (409)
- `InvalidCredentials` (401)
- `InvalidSpecialityException` (409)
- `PractitionerNotAvailableException` (409)

**API RDV/Disponibilités :**
- `ValidationError` (400)
- `PastDateException` (400)
- `SlotAlreadyTakenException` (409)
- `CancellationTooLateException` (409)
- `SlotOverlapException` (409)
- `PractitionerUnavailableException` (409)
- `ConsultationNotFinalizedException` (409)

**API Dossiers Médicaux :**
- `AccessDeniedException` (403)
- `ValidationError` (400)
- `ChronicConditionCannotBeArchivedException` (409)
- `AllergyLinkedToActivePrescriptionException` (409)

**API Ordonnances :**
- `ValidationError` (400)
- `ForbiddenException` (403)
- `ConsultationNotFinalizedException` (409)
- `AllergyConflictException` (409)
- `PrescriptionExpiredException` (409)

---

## 3. Format de pagination

**Tous les endpoints qui retournent une liste doivent supporter la pagination avec les paramètres suivants :**

| Paramètre | Type | Description | Défaut | Requis |
|-----------|------|-------------|--------|--------|
| `page` | number | Numéro de page (1-based) | 1 | ❌ |
| `limit` | number | Nombre d'éléments par page | 10 | ❌ |

**Format de la réponse :**

```json
{
  "items": [
    { ... },
    { ... }
  ],
  "count": 25,
  "page": 1,
  "limit": 10
}
```

**Exemple d'utilisation :**
```bash
GET /praticiens?page=2&limit=20
```

---

## 4. Contrats OpenAPI

Les fichiers OpenAPI complets pour chaque API sont disponibles dans :
- `/docs/openapi-utilisateurs.yaml`
- `/docs/openapi-rdv.yaml`
- `/docs/openapi-dossiers.yaml`
- `/docs/openapi-ordonnances.yaml`

Chaque fichier contient :
- Schémas d'entrée/sortie
- Exemples de requêtes/réponses
- Cas d'erreur documentés
- Paramètres de requête

---

## 5. Règles de validation

### 5.1 Utilisateurs

**Registration :**
- `email` : format email valide, unique
- `password` : min 8 caractères
- `type` : `PRATICIEN` ou `PATIENT`
- `firstName`, `lastName` : requis
- Si `type === PRATICIEN` : `specialite`, `rpps` requis
- Si `type === PATIENT` : `dateNaissance`, `nss` requis

### 5.2 Rendez-vous

- `date` : format `YYYY-MM-DD`, pas dans le passé
- `heure` : format `HH:MM`
- `duree` : nombre positif (default: 30)
- Vérifier que le créneau n'est pas déjà pris
- Vérifier que le praticien est ACTIF

### 5.3 Transitions de statut RDV

```
PLANIFIE → CONFIRME (par patient ou praticien)
PLANIFIE → ANNULE (par patient ou praticien, si > 2h avant)
PLANIFIE → NON_VENU (par praticien uniquement)
CONFIRME → EN_COURS (par praticien uniquement)
EN_COURS → TERMINE (par praticien uniquement)
CONFIRME → ANNULE (par patient ou praticien, si > 2h avant)
CONFIRME → NON_VENU (par praticien uniquement)
```

### 5.4 Comptes Rendus

- Peuvent être créés **uniquement** sur un RDV avec `statut === TERMINE`
- Peuvent être créés **uniquement** par le praticien du RDV
- Un seul compte rendu par RDV

### 5.5 Ordonnances

- Peuvent être créées **uniquement** sur un compte rendu finalisé
- Peuvent être créées **uniquement** par le praticien du compte rendu
- Date de validité par défaut : 3 mois après l'émission
- **Expiration paresseuse** : à chaque GET/UPDATE, vérifier si `dateValidite < now` et mettre à jour `statut = EXPIREE`

### 5.6 Lignes de prescription

- Vérifier que l'ordonnance n'est pas EXPIREE
- Vérifier les conflits d'allergies
- Logger dans CloudWatch si durée > 90 jours

### 5.7 Allergies

- Ne peuvent pas être supprimées si liées à une ordonnance ACTIVE
- Log dans CloudWatch à chaque CREATE/UPDATE/DELETE

### 5.8 Antécédents

- Les antécédents CHRONIQUE ne peuvent pas être archivés

---

## 6. Règles d'accès

### 6.1 Accès aux données

| Donnée | Qui peut accéder | Méthode |
|--------|-------------------|---------|
| Profil utilisateur | Lui-même | GET /utilisateurs/me |
| Liste des praticiens | Tout le monde | GET /praticiens |
| Disponibilités d'un praticien | Tout le monde | GET /praticiens/{id}/disponibilites |
| Créneaux disponibles | Tout le monde | GET /praticiens/{id}/creneaux |
| RDVs d'un patient | Le patient, le praticien du RDV | GET /rendezvous?patientId={id} |
| RDVs d'un praticien | Le praticien | GET /rendezvous?praticienId={id} |
| Dossier médical | Le patient, praticien qui l'a consulté | GET /patients/{id}/dossier |
| Ordonnances | Le patient, le praticien | GET /ordonnances?patientId={id} |

### 6.2 Médecin traitant

- Un patient peut **désigner** son médecin traitant via `PUT /patients/me/medecin-traitant`
- Un patient peut **changer** son médecin traitant
- Un praticien **ne peut pas** se désigner comme médecin traitant d'un patient
- Un praticien **ne peut pas** être médecin traitant s'il est `EN_CONGE` ou `INACTIF`

### 6.3 Accès praticien-patient

- Un praticien peut accéder au dossier médical d'un patient **uniquement** s'il a eu au moins un RDV TERMINE avec ce patient
- Vérification via la table `RendezVous` :
  ```
  WHERE praticienId = :praticienId 
    AND patientId = :patientId 
    AND statut = 'TERMINE'
  ```

---

## 7. Biais et limitations

### 7.1 Expiration paresseuse (décision n°4)

- Les ordonnances ne sont pas automatiquement marquées comme EXPIREE
- À chaque lecture ou modification, on vérifie si `dateValidite < now`
- Si oui, on met à jour `statut = EXPIREE` **avant** de répondre
- **Biais** : Une ordonnance expirée jamais consultée reste ACTIVE en base

### 7.2 Communication inter-services

- **Choix retenu** : DynamoDB partagée
- Chaque Lambda lit directement les tables des autres APIs
- **Avantages** :
  - Pas de latence HTTP
  - Pas de cascade de pannes
  - IAM simple
- **Alternative documentée** : Appels HTTP entre API Gateway

### 7.3 Calcul des créneaux disponibles

- Algorithme : disponibilités hebdomadaires - indisponibilités ponctuelles - RDVs existants
- Ne prend pas en compte les RDVs ANNULE ou NON_VENU
- Les créneaux sont générés par tranches de 30 minutes (configurable)

---

## 8. Liste des endpoints par API

Voir les fichiers OpenAPI dans `/docs/` pour les détails complets.

### API Utilisateurs
- `POST /auth/register`
- `POST /auth/login`
- `GET /utilisateurs/me`
- `PATCH /utilisateurs/me`
- `PUT /patients/me/medecin-traitant`
- `PATCH /praticiens/me/statut`
- `GET /praticiens`

### API Disponibilités/RDV/Comptes Rendus
- `PUT /praticiens/me/disponibilites`
- `GET /praticiens/me/disponibilites`
- `GET /praticiens/{id}/disponibilites`
- `POST /praticiens/me/indisponibilites`
- `GET /praticiens/me/indisponibilites`
- `DELETE /indisponibilites/{id}`
- `GET /praticiens/{id}/creneaux`
- `POST /rendezvous`
- `GET /rendezvous`
- `POST /rendezvous/{id}/confirmer`
- `POST /rendezvous/{id}/annuler`
- `POST /rendezvous/{id}/en-cours`
- `POST /rendezvous/{id}/termine`
- `POST /rendezvous/{id}/non-venu`
- `POST /rendezvous/{id}/compte-rendu`
- `GET /rendezvous/{id}/compte-rendu`

### API Dossiers Médicaux
- `GET /patients/{id}/dossier`
- `POST /dossiers/{id}/antecedents`
- `PATCH /antecedents/{id}`
- `POST /antecedents/{id}/archiver`
- `GET /patients/{id}/antecedents`
- `POST /dossiers/{id}/allergies`
- `DELETE /allergies/{id}`
- `GET /patients/{id}/allergies`
- `POST /dossiers/{id}/vaccinations`
- `GET /patients/{id}/vaccinations`

### API Ordonnances
- `POST /ordonnances`
- `GET /ordonnances/{id}`
- `GET /ordonnances`
- `POST /ordonnances/{id}/lignes`
- `DELETE /ordonnances/{id}/lignes/{ligneId}`
- `GET /ordonnances/{id}/lignes`
- `GET /medicaments`
- `POST /medicaments`

---

## 9. Exemples de données

### Utilisateur (Patient)
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "patient@test.com",
  "passwordHash": "$2a$10$...",
  "type": "PATIENT",
  "firstName": "Jean",
  "lastName": "Dupont",
  "name": "Jean Dupont",
  "dateNaissance": "1990-01-01",
  "nss": "123456789012345",
  "medecinTraitantId": "660e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T10:00:00Z"
}
```

### Utilisateur (Praticien)
```json
{
  "userId": "660e8400-e29b-41d4-a716-446655440001",
  "email": "docteur@test.com",
  "passwordHash": "$2a$10$...",
  "type": "PRATICIEN",
  "firstName": "Marie",
  "lastName": "Martin",
  "name": "Marie Martin",
  "specialite": "Médecine générale",
  "rpps": "1234567890",
  "statut": "ACTIF",
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T10:00:00Z"
}
```

### Rendez-vous
```json
{
  "rdvId": "770e8400-e29b-41d4-a716-446655440002",
  "praticienId": "660e8400-e29b-41d4-a716-446655440001",
  "patientId": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2024-12-25",
  "heure": "14:30",
  "duree": 30,
  "statut": "CONFIRME",
  "createdAt": "2024-12-20T10:00:00Z",
  "updatedAt": "2024-12-20T15:00:00Z"
}
```

### Ordonnance
```json
{
  "ordonnanceId": "880e8400-e29b-41d4-a716-446655440003",
  "compteRenduId": "990e8400-e29b-41d4-a716-446655440004",
  "patientId": "550e8400-e29b-41d4-a716-446655440000",
  "rdvId": "770e8400-e29b-41d4-a716-446655440002",
  "praticienId": "660e8400-e29b-41d4-a716-446655440001",
  "dateEmission": "2024-12-25T15:00:00Z",
  "dateValidite": "2025-03-25T15:00:00Z",
  "statut": "ACTIVE",
  "createdAt": "2024-12-25T15:00:00Z",
  "updatedAt": "2024-12-25T15:00:00Z"
}
```

---

## 10. Historique des modifications

| Date | Modification | Auteur | Impact |
|------|-------------|--------|--------|
| 2024-XX-XX | Création initiale | - | - |
| 2024-XX-XX | Ajout des GSIs manquantes | - | - |
| 2024-XX-XX | Correction du type de `duree` | - | - |

**⚠️ TOUTE MODIFICATION DOIT ÊTRE RECENSÉE ICI**
