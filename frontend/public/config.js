/**
 * Configuration runtime HealthTrack
 * 
 * Ce fichier est chargé AVANT le bundle React (dans index.html).
 * Remplacez les valeurs par les vraies URLs après le déploiement AWS :
 *   - API Gateway : aws apigateway get-rest-apis → copier l'URL de chaque stage
 *   - CloudFront  : aws cloudfront list-distributions → copier le DomainName
 * 
 * Exemple après déploiement :
 *   window.healthtrackConfig = {
 *     API_UTILISATEURS_URL: "https://xxxxxxxxxx.execute-api.eu-west-1.amazonaws.com/prod",
 *     API_RDV_URL:          "https://yyyyyyyyyy.execute-api.eu-west-1.amazonaws.com/prod",
 *     API_DOSSIERS_URL:     "https://zzzzzzzzzz.execute-api.eu-west-1.amazonaws.com/prod",
 *     API_ORDONNANCES_URL:  "https://wwwwwwwwww.execute-api.eu-west-1.amazonaws.com/prod",
 *     COGNITO_USER_POOL_ID: "eu-west-1_XXXXXXXXX",
 *     COGNITO_CLIENT_ID:    "xxxxxxxxxxxxxxxxxxxxxxxxxx"
 *   };
 */
window.healthtrackConfig = {
  // En développement local, le proxy Vite redirige /api-* vers localhost:300x
  API_UTILISATEURS_URL: "/api-utilisateurs",
  API_RDV_URL: "/api-rdv",
  API_DOSSIERS_URL: "/api-dossiers",
  API_ORDONNANCES_URL: "/api-ordonnances",
  COGNITO_USER_POOL_ID: "",
  COGNITO_CLIENT_ID: ""
};
