/**
 * Configuration runtime HealthTrack (chargée avant le bundle React, cf. index.html).
 *
 * En local : les chemins /api-* passent par le proxy Vite (vite.config.js) vers localhost:8081..8084.
 * Sur AWS  : infrastructure/deploy-frontend.sh réécrit ce fichier avec les URLs API Gateway.
 */
window.healthtrackConfig = {
  API_UTILISATEURS_URL: "/api-utilisateurs",
  API_RDV_URL: "/api-rdv",
  API_DOSSIERS_URL: "/api-dossiers",
  API_ORDONNANCES_URL: "/api-ordonnances"
};
