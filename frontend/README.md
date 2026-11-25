# Frontend — HealthTrack

Frontend React pour l'application HealthTrack (gestion de cabinet médical).

## 📋 Fonctionnalités

### Pages disponibles

| Page | Route | Description | Rôle requis |
|------|-------|-------------|--------------|
| Accueil | `/` | Page d'accueil adaptée au rôle | ✅ Tout |
| Connexion | `/login` | Formulaire de connexion | ❌ Public |
| Inscription | `/register` | Formulaire d'inscription | ❌ Public |
| Profil | `/profile` | Consultation/modification du profil | ✅ Tout |
| Agenda | `/agenda` | Rendez-vous du jour/semaine | ✅ Praticien |
| Disponibilités | `/disponibilites` | Gestion des créneaux | ✅ Praticien |
| Prise de RDV | `/prise-rdv` | Réservation de créneaux | ✅ Patient |
| Dossier médical | `/dossier-medical` | Historique médical | ✅ Patient |
| Compte rendu | `/rendezvous/:rdvId/compte-rendu` | Rédaction de compte rendu | ✅ Praticien |
| Ordonnance | `/ordonnances/new` | Création d'ordonnance | ✅ Praticien |

### Fonctionnalités transversales

- ✅ Authentification JWT avec Cognito
- ✅ Routing par rôle (Praticien/Patient)
- ✅ Gestion des erreurs HTTP (400, 401, 403, 404, 409)
- ✅ Protection des routes
- ✅ Design responsive
- ✅ Pages 404

## 🛠 Configuration

### Variables d'environnement

Créer un fichier `.env` à la racine du frontend :

```env
# Configuration AWS Cognito
VITE_COGNITO_USER_POOL_ID=eu-west-1_XXXXXXXX
VITE_COGNITO_APP_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_COGNITO_REGION=eu-west-1

# URLs des APIs
VITE_API_UTILISATEURS_URL=https://XXXXXXX.execute-api.eu-west-1.amazonaws.com/prod
VITE_API_RDV_URL=https://XXXXXXX.execute-api.eu-west-1.amazonaws.com/prod
VITE_API_DOSSIERS_URL=https://XXXXXXX.execute-api.eu-west-1.amazonaws.com/prod
VITE_API_ORDONNANCES_URL=https://XXXXXXX.execute-api.eu-west-1.amazonaws.com/prod
```

### Fichiers de configuration

- `vite.config.js` : Configuration de Vite (proxy pour développement)
- `src/main.jsx` : Point d'entrée, injection de la configuration

## 🚀 Développement

### Installation

```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement (http://localhost:3000)
npm run dev
```

### Développement avec API locale

Si vous utilisez LocalStack ou DynamoDB Local :

```bash
# Créer un fichier .env.local
cp .env .env.local

# Mettre à jour les URLs pour pointer vers localhost
VITE_API_UTILISATEURS_URL=http://localhost:3001
VITE_API_RDV_URL=http://localhost:3002
VITE_API_DOSSIERS_URL=http://localhost:3003
VITE_API_ORDONNANCES_URL=http://localhost:3004
```

### Proxy pour développement

Le fichier `vite.config.js` contient un proxy pour les APIs :

```javascript
proxy: {
  '/api-utilisateurs': 'http://localhost:3001',
  '/api-rdv': 'http://localhost:3002',
  '/api-dossiers': 'http://localhost:3003',
  '/api-ordonnances': 'http://localhost:3004'
}
```

## 📦 Build

```bash
# Générer le build pour production
npm run build

# Le build est généré dans le dossier /dist
# Ce dossier doit être uploadé sur S3 pour le déploiement
```

## 🧪 Tests

```bash
# Exécuter les tests
npm test

# Lancer le linter
npm run lint
```

## 📁 Structure

```
frontend/
├── public/                     # Fichiers statiques
│   └── index.html              # Page HTML principale
│
├── src/
│   ├── components/             # Composants React
│   │   ├── Layout.jsx          # Layout principal (header, footer)
│   │   ├── ProtectedRoute.jsx  # Route protégée
│   │   ├── PraticienRoute.jsx  # Route praticien uniquement
│   │   ├── PatientRoute.jsx    # Route patient uniquement
│   │   └── ...
│   │
│   ├── pages/                  # Pages de l'application
│   │   ├── HomePage.jsx        # Page d'accueil
│   │   ├── LoginPage.jsx       # Page de connexion
│   │   ├── RegisterPage.jsx    # Page d'inscription
│   │   ├── ProfilePage.jsx     # Page de profil
│   │   ├── NotFoundPage.jsx    # Page 404
│   │   │
│   │   ├── praticien/          # Pages praticien
│   │   │   ├── AgendaPage.jsx
│   │   │   ├── DisponibilitesPage.jsx
│   │   │   ├── CompteRenduPage.jsx
│   │   │   └── OrdonnancePage.jsx
│   │   │
│   │   └── patient/            # Pages patient
│   │       ├── PriseRdvPage.jsx
│   │       └── DossierMedicalPage.jsx
│   │
│   ├── services/               # Services et logique métier
│   │   ├── auth.jsx            # Service d'authentification
│   │   └── api.jsx             # Service API HTTP
│   │
│   ├── styles/                 # Styles CSS
│   │   └── index.css           # Styles globaux
│   │
│   ├── App.jsx                 # Application principale (routing)
│   └── main.jsx                # Point d'entrée
│
├── package.json
├── vite.config.js
└── README.md
```

## 🎨 Styles

### Variables CSS

Les variables CSS sont définies dans `src/styles/index.css` :

```css
:root {
  --color-primary: #2563eb;
  --color-secondary: #64748b;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  /* ... */
}
```

### Composants stylisés

- Boutons (`.btn`, `.btn-primary`, `.btn-secondary`, etc.)
- Formulaires (`.form-group`, `.auth-form`, etc.)
- Cartes (`.card`)
- Alertes (`.alert`, `.alert-error`, etc.)
- Layout responsive

## ✅ Bonnes pratiques

### Gestion des erreurs

Utiliser le hook `useApiRequest` pour gérer les erreurs API :

```jsx
const { request, handleApiError } = useApiRequest();

const fetchData = async () => {
  const { data, error } = await request('GET', '/rendezvous');
  
  if (error) {
    // Afficher l'erreur
    setError(error.message);
    return;
  }
  
  // Traiter les données
  setRendezvous(data.items);
};
```

### Authentification

Utiliser le hook `useAuth` pour accéder à l'utilisateur courant :

```jsx
const { user, isAuthenticated, hasRole, logout } = useAuth();

if (!isAuthenticated()) {
  return <Navigate to="/login" />;
}

if (hasRole(Role.PRATICIEN)) {
  // Afficher le contenu praticien
}
```

### Routes protégées

Utiliser les composants `ProtectedRoute`, `PraticienRoute`, `PatientRoute` :

```jsx
<Route path="/agenda" element={
  <ProtectedRoute>
    <PraticienRoute>
      <PraticienAgendaPage />
    </PraticienRoute>
  </ProtectedRoute>
} />
```

### Appels API

Utiliser les clients API dédiés :

```jsx
import { createRdvClient } from '../services/api';

const client = createRdvClient(token);
const response = await client.get('/praticiens/123/creneaux');
```

## 🔧 Déploiement

Le déploiement du frontend est géré par le script `infrastructure/deploy-frontend.sh` :

1. Builder le frontend : `npm run build`
2. Exécuter : `./infrastructure/deploy-frontend.sh`

Le script :
- Crée un bucket S3
- Active l'hébergement statique
- Configure les permissions
- Crée une distribution CloudFront
- Upload le build depuis `/dist`

## 💡 Conseils

### Pour la soutenance

1. **Préparez une démo** :
   - Montrez la page d'accueil
   - Connectez-vous comme patient et comme praticien
   - Montrez les fonctionnalités principales

2. **Expliquez l'architecture** :
   - React pour le frontend
   - Routing avec React Router
   - Authentification avec JWT
   - Appels API avec Axios

3. **Justifiez les choix** :
   - Pourquoi React ? → Composants réutilisables, écosystème riche
   - Pourquoi Vite ? → Build rapide, configuration simple
   - Pourquoi Axios ? → Intercepteurs, gestion des erreurs

### Pour le développement

1. **Testez en local** : Utilisez LocalStack ou DynamoDB Local
2. **Vérifiez les erreurs** : Utilisez le hook `useApiRequest` pour une gestion centralisée
3. **Respectez les contrats** : Voir `/docs/contrats.md` pour les formats d'API

## 📚 Ressources

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [React Router](https://reactrouter.com/)
- [AWS Amplify Auth](https://docs.amplify.aws/lib/auth/getting-started/q/platform/js/)
- [Axios Documentation](https://axios-http.com/)

---

**Développé avec ❤️ pour les professionnels de santé.**
