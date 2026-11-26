# Frontend — HealthTrack

Application React 18 (Vite) qui consomme les 4 APIs HealthTrack. Elle est publiée sur S3 par
`infrastructure/deploy-frontend.sh`.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de production dans dist/
```

### Choisir les APIs utilisées

Les URLs des APIs sont lues **à l'exécution** dans `window.healthtrackConfig`, défini par `public/config.js`
(chargé avant le bundle par `index.html`) :

```js
window.healthtrackConfig = {
  API_UTILISATEURS_URL: "/api-utilisateurs",
  API_RDV_URL: "/api-rdv",
  API_DOSSIERS_URL: "/api-dossiers",
  API_ORDONNANCES_URL: "/api-ordonnances"
};
```

- **APIs locales** (valeurs par défaut) : le proxy de `vite.config.js` redirige `/api-utilisateurs` → `localhost:8081`,
  `/api-rdv` → `8082`, `/api-dossiers` → `8083`, `/api-ordonnances` → `8084` en retirant le préfixe.
- **APIs déployées sur AWS** : remplacer ces valeurs par les URLs de `../.env.apigateway`.
- **Sur S3** : `deploy-frontend.sh` réécrit `dist/config.js` avec les URLs API Gateway ; aucun rebuild n'est
  nécessaire pour changer d'environnement.

## Écrans

| Écran | Route | Rôle | APIs appelées |
|---|---|---|---|
| Connexion / Inscription | `/login`, `/register` | public | Utilisateurs |
| Accueil (tableau de bord : chiffres du jour, prochains RDV, raccourcis) | `/` | tous | RDV, Ordonnances, Utilisateurs |
| Profil, statut praticien, médecin traitant | `/profile` | tous | Utilisateurs |
| Prise de rendez-vous (créneaux libres) | `/prise-rdv` | patient | Utilisateurs, RDV |
| Mes rendez-vous (pagination, filtre statut, annulation, compte rendu) | `/mes-rendezvous` | patient | RDV |
| Mes ordonnances (filtre statut, détail des lignes) | `/mes-ordonnances` | patient | Ordonnances |
| Mon dossier médical | `/dossier-medical` | patient | Dossiers |
| Agenda du jour / de la semaine (confirmer, démarrer, terminer, absent, annuler) | `/agenda` | praticien | RDV |
| Disponibilités hebdomadaires et indisponibilités | `/disponibilites` | praticien | RDV |
| Compte rendu (brouillon puis finalisation) | `/rendezvous/:rdvId/compte-rendu` | praticien | RDV |
| Ordonnance (création, lignes, rappel des allergies) | `/rendezvous/:rdvId/ordonnance` | praticien | RDV, Ordonnances, Dossiers |
| Dossier médical d'un patient déjà consulté | `/patients/:patientId/dossier` | praticien | Dossiers, Utilisateurs, Ordonnances |

Parcours praticien typique : **Agenda** → Confirmer → Commencer → Terminer → **Compte rendu** (finaliser) →
**Ordonnance** ; le bouton **Dossier** est disponible dès que la consultation est en cours.

## Organisation du code

```
src/
  App.jsx                    routes (ProtectedRoute / PatientRoute / PraticienRoute)
  components/Layout.jsx      en-tête, navigation selon le rôle, pied de page
  services/auth.jsx          contexte d'authentification (token JWT et utilisateur dans localStorage)
  services/api.jsx           URLs des APIs (window.healthtrackConfig)
  utils/format.js            dates (locales, pas d'UTC), libellés des statuts, messages d'erreur des APIs
  pages/                     pages communes
  pages/patient/             pages patient
  pages/praticien/           pages praticien
  styles/index.css           thème (variables CSS, police Nunito)
```

Les messages d'erreur affichés sont ceux renvoyés par les APIs (champ `message`), par exemple
« Annulation impossible moins de 2h avant le rendez-vous ».
