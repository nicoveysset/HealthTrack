/**
 * Point d'entrée de l'application HealthTrack
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Récupérer la configuration depuis les variables d'environnement
const config = {
  API_UTILISATEURS_URL: import.meta.env.VITE_API_UTILISATEURS_URL || '/api-utilisateurs',
  API_RDV_URL: import.meta.env.VITE_API_RDV_URL || '/api-rdv',
  API_DOSSIERS_URL: import.meta.env.VITE_API_DOSSIERS_URL || '/api-dossiers',
  API_ORDONNANCES_URL: import.meta.env.VITE_API_ORDONNANCES_URL || '/api-ordonnances',
  COGNITO_USER_POOL_ID: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  COGNITO_APP_CLIENT_ID: import.meta.env.VITE_COGNITO_APP_CLIENT_ID || '',
  COGNITO_REGION: import.meta.env.VITE_COGNITO_REGION || 'eu-west-1'
};

// Injecter la configuration dans l'application
window.healthtrackConfig = config;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
