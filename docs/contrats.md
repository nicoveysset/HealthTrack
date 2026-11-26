# Contrats techniques — HealthTrack

Ce document décrit ce que les 4 APIs partagent : le schéma DynamoDB et qui écrit / lit quoi, le format des
erreurs, la pagination, les cycles de vie et les règles d'accès.

Les contrats d'interface détaillés (routes, corps, exemples, cas d'erreur) sont les fichiers OpenAPI de ce dossier.
Ce sont eux qu'affiche le Swagger UI de chaque API.

| API | Contrat OpenAPI | Lambda |
|---|---|---|
| Utilisateurs | [openapi-utilisateurs.yaml](openapi-utilisateurs.yaml) | `healthtrack-api-utilisateurs` |
| Disponibilités & RDV | [openapi-disponibilites-rdv.yaml](openapi-disponibilites-rdv.yaml) | `healthtrack-api-rdv` |
| Dossiers médicaux | [openapi-dossiers-medicaux.yaml](openapi-dossiers-medicaux.yaml) | `healthtrack-api-dossiers` |
| Ordonnances | [openapi-ordonnances.yaml](openapi-ordonnances.yaml) | `healthtrack-api-ordonnances` |

---

## 1. Tables DynamoDB et propriété des données

Chaque table a **une seule API propriétaire**, la seule à y écrire. Les autres APIs peuvent la lire pour
vérifier une règle métier (cf. §2). Toutes les tables sont en facturation à la demande (`PAY_PER_REQUEST`).

| Table | Clé | Index secondaires (GSI) | Propriétaire | Lue aussi par |
|---|---|---|---|---|
| `healthtrack-utilisateurs` | `userId` | `byEmail` (email), `byMedecinTraitant` (medecinTraitantId, type) | Utilisateurs | RDV |
| `healthtrack-disponibilites` | `dispoId` | `byPraticien`, `byPraticienAndJour` (praticienId, jourSemaine) | RDV | — |
| `healthtrack-indisponibilites` | `indispoId` | `byPraticien`, `byPraticienAndDate` (praticienId, dateDebut) | RDV | — |
| `healthtrack-rendezvous` | `rdvId` | `byPraticienAndDate`, `byPatientAndDate` (…, date), `byStatut` | RDV | Dossiers, Ordonnances |
| `healthtrack-comptes-rendus` | `compteRenduId` | `byRdv`, `byPraticien`, `byPatient` | RDV | Ordonnances |
| `healthtrack-dossiers-medicaux` | `patientId` | — | Dossiers | — |
| `healthtrack-antecedents` | `antecedentId` | `byDossier`, `byDossierAndType`, `byStatut` | Dossiers | — |
| `healthtrack-allergies` | `allergieId` | `byPatient` | Dossiers | Ordonnances |
| `healthtrack-vaccinations` | `vaccinationId` | `byDossier`, `byDossierAndNom` | Dossiers | — |
| `healthtrack-ordonnances` | `ordonnanceId` | `byCompteRendu`, `byPatientAndDate` (patientId, dateEmission), `byRendezVous`, `byStatut` | Ordonnances | Dossiers |
| `healthtrack-lignes-prescription` | `ordonnanceId` + `ligneId` | — | Ordonnances | Dossiers |
| `healthtrack-medicaments` | `medicamentId` | `byForme`, `bySubstanceActive` | Ordonnances | Dossiers |

Remarques :
- le dossier médical d'un patient a pour clé **l'identifiant du patient** (`patientId` = `dossierId`) ;
- les noms des patients et praticiens sont recopiés dans les rendez-vous (`patientNom`, `praticienNom`) et les
  ordonnances. Ils servent à l'affichage sans appel supplémentaire ;
- quelques attributs sont stockés avec des accents dans DynamoDB : `libellé`, `médicamentConcerne`, `sévérité`,
  `dateDécouverte`, `rappelPrévu`, `récurrente`. Le JSON des APIs utilise les noms sans accent (`libelle`,
  `medicamentConcerne`...). Les classes de lecture des autres APIs reprennent exactement ces noms d'attributs.

## 2. Communication entre services

| Besoin | API appelante | Mécanisme |
|---|---|---|
| Identifier l'utilisateur | RDV, Dossiers, Ordonnances | Vérification locale du JWT émis par l'API Utilisateurs (secret partagé `JWT_SECRET`) |
| Praticien ACTIF ? Nom du patient ? | RDV | Lecture de `healthtrack-utilisateurs` |
| Le praticien a-t-il déjà reçu ce patient ? | Dossiers, Ordonnances | Lecture de `healthtrack-rendezvous` (index `byPatientAndDate`, statut TERMINE ou EN_COURS) |
| Allergie liée à une ordonnance active ? | Dossiers | Lecture de `healthtrack-ordonnances`, `-lignes-prescription`, `-medicaments` |
| Consultation TERMINE, compte rendu finalisé, bon praticien ? | Ordonnances | Lecture de `healthtrack-rendezvous` et `healthtrack-comptes-rendus` |
| Patient allergique au médicament ? | Ordonnances | Lecture de `healthtrack-allergies` |

**Correspondance allergie ↔ médicament.** L'allergie (« Amoxicilline ») est comparée au nom commercial et à la
substance active du médicament, mot par mot, en ignorant les accents et la casse. Elle bloque donc
« Amoxicilline 500 mg » comme « Augmentin » (amoxicilline + acide clavulanique).

## 3. Format des réponses

### Erreurs

Toutes les erreurs, y compris 401, 404 de route et 500, suivent ce format :

```json
{
  "error": "CancellationTooLateException",
  "message": "Annulation impossible moins de 2h avant le rendez-vous (il reste 70 min)",
  "statusCode": 409,
  "path": "/rendezvous/8a1f2c3d-...",
  "timestamp": "2026-11-26T10:00:00Z"
}
```

| Code | Signification | Exceptions |
|---|---|---|
| 400 | Requête mal formée (JSON, date, enum, pagination) | `ValidationException` |
| 401 | Token absent, expiré ou invalide ; mauvais identifiants | `UnauthorizedException`, `InvalidCredentialsException` |
| 403 | Droit insuffisant | `ForbiddenException`, `AccessDeniedException` |
| 404 | Ressource ou route inexistante | `NotFoundException` |
| 409 | Conflit avec l'état actuel des données | `EmailAlreadyUsedException`, `PractitionerNotAvailableException`, `SlotAlreadyTakenException`, `SlotOverlapException`, `PractitionerUnavailableException`, `CancellationTooLateException`, `InvalidStatusTransitionException`, `ConsultationNotFinalizedException`, `CompteRenduAlreadyFinalizedException`, `ChronicConditionCannotBeArchivedException`, `AllergyLinkedToActivePrescriptionException`, `AllergyConflictException`, `PrescriptionExpiredException`, `ConflictException` |
| 422 | Donnée valide mais refusée par une règle métier | `InvalidSpecialityException`, `PastDateException`, `OutsideAvailabilityException` |
| 500 | Erreur inattendue (loggée en ERROR avec la pile) | `InternalServerError` |

Chaque exception est une classe du package `exception` de son API, qui hérite de `ApiException` (code HTTP + nom).

### Pagination

Les listes paginées acceptent `page` (≥ 1, défaut 1) et `limit` (1 à 100) et renvoient :

```json
{ "items": [ ... ], "count": 42, "page": 2, "limit": 10 }
```

`count` est le nombre **total** d'éléments après filtrage, toutes pages confondues.

| Route paginée | Filtres |
|---|---|
| `GET /praticiens` | `specialite`, `statut` |
| `GET /rendezvous` | `statut` (un ou plusieurs, séparés par des virgules), `dateDebut`, `dateFin` |
| `GET /ordonnances` | `patientId`, `rdvId`, `statut` |
| `GET /medicaments` | `forme`, `search` |

### Dates

- Dates : `YYYY-MM-DD` ; heures : `HH:MM` ; horodatages techniques (`createdAt`...) : ISO 8601 UTC.
- Les dates et heures métier (rendez-vous, indisponibilités, « maintenant ») sont dans le fuseau du cabinet,
  **Europe/Paris**. Ce fuseau est fixé par un `Clock` injecté (`TimeConfig`), car Lambda tourne en UTC.

## 4. Cycles de vie

### Rendez-vous

```
PLANIFIE ──► CONFIRME ──► EN_COURS ──► TERMINE
   │             │
   ├──► ANNULE ◄─┤      patient ou praticien, au plus tard 2h avant
   └──► NON_VENU ◄┘     praticien, une fois l'heure du rendez-vous passée
```
EN_COURS, TERMINE et NON_VENU ne peuvent être appliqués que par le praticien du rendez-vous. Les rendez-vous
ANNULE et NON_VENU libèrent leur créneau.

### Compte rendu

`BROUILLON` (modifiable par `PUT`) ──► `FINALISE` (définitif). Il n'est rédigeable que sur un rendez-vous TERMINE.
Le patient ne voit que les comptes rendus finalisés.

### Ordonnance

Créée `ACTIVE`, valable 3 mois. Elle passe `EXPIREE` dès que sa date de validité est dépassée : le statut est
réévalué à chaque lecture. Une ordonnance expirée n'accepte plus ni ajout ni retrait de ligne.

### Antécédent

`ACTIF` ⇄ `ARCHIVE` via `PATCH /antecedents/{id}`. Un antécédent `CHRONIQUE` ne peut pas être archivé.

## 5. Règles d'accès

| Ressource | Patient | Praticien |
|---|---|---|
| Son profil | lecture, modification | lecture, modification, statut |
| Profil d'un autre utilisateur | praticiens uniquement | tous |
| Disponibilités / indisponibilités | lecture des disponibilités | gestion des siennes |
| Rendez-vous | les siens | ceux de son agenda |
| Compte rendu | lecture s'il est finalisé | rédaction pour ses consultations |
| Dossier médical | le sien | patients **déjà reçus** (consultation TERMINE ou EN_COURS), sinon `AccessDeniedException` |
| Ordonnances | les siennes | celles qu'il a émises + celles des patients déjà reçus ; création et modification uniquement pour ses consultations |

## 6. Journalisation (CloudWatch)

Chaque action métier écrit une ligne JSON avec un champ `event`, qu'on peut filtrer dans CloudWatch Logs Insights :

| API | Événements |
|---|---|
| Utilisateurs | `USER_REGISTERED`, `USER_LOGIN`, `PROFILE_UPDATED`, `MEDECIN_TRAITANT_SET`, `PRATICIEN_STATUT_CHANGED` |
| RDV | `DISPONIBILITES_UPDATED`, `INDISPONIBILITE_CREATED/DELETED`, `RDV_CREATED`, `RDV_STATUT_CHANGED`, `COMPTE_RENDU_CREATED/UPDATED/FINALIZED` |
| Dossiers | `DOSSIER_CONSULTED`, `DOSSIER_ACCESS_DENIED`, `ANTECEDENT_CREATED/UPDATED`, `ALLERGIE_CREATED`, **`ALLERGIE_UPDATED`** (identité du praticien, valeurs avant/après), `ALLERGIE_DELETED`, `VACCINATION_CREATED` |
| Ordonnances | `ORDONNANCE_CREATED`, `ORDONNANCE_EXPIRED`, `LIGNE_ADDED`, `LIGNE_REMOVED`, **`ALLERGY_CONFLICT`**, **`ALERTE_PRESCRIPTION_LONGUE_DUREE`** |
| Toutes | `BUSINESS_ERROR` (WARN, chaque exception métier), `UNEXPECTED_ERROR` (ERROR) |

`ALLERGY_CONFLICT` et `ALERTE_PRESCRIPTION_LONGUE_DUREE` produisent aussi une métrique CloudWatch (namespace
`HealthTrack/Ordonnances`, métriques `AllergyConflict` et `PrescriptionLongueDuree`). Ces métriques sont publiées
au format Embedded Metric Format, et `infrastructure/deploy-monitoring.sh` pose une alarme sur chacune.
