/**
 * Service API HealthTrack
 * Gère les requêtes HTTP vers les différentes APIs
 */
import axios from 'axios';
import { useAuth } from './auth';

// Configuration de base pour axios
export const createApiClient = (baseURL, token = null) => {
  return axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  });
};

// Client API avec gestion automatique du token
export const useApi = () => {
  const { token, logout } = useAuth();

  // Créer un client axios avec intercepteur pour ajouter le token
  const api = axios.create({
    baseURL: '', // Sera défini par API
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Intercepteur pour ajouter le token à chaque requête
  api.interceptors.request.use(
    (config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Intercepteur pour gérer les erreurs 401 (token expiré)
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        logout();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  return api;
};

// Hook personnalisé pour les requêtes API avec gestion d'erreur
export const useApiRequest = () => {
  const api = useApi();

  const request = async (method, url, data = null, params = null) => {
    try {
      const config = {
        method,
        url,
        ...(data && { data }),
        ...(params && { params })
      };

      const response = await api(config);
      return { data: response.data, error: null };
    } catch (error) {
      return { data: null, error: handleApiError(error) };
    }
  };

  const handleApiError = (error) => {
    if (error.response) {
      const { status, data } = error.response;
      return {
        status,
        message: data.message || data.error || 'Une erreur est survenue',
        details: data
      };
    } else if (error.request) {
      return {
        status: null,
        message: 'Pas de réponse du serveur',
        details: null
      };
    } else {
      return {
        status: null,
        message: 'Erreur de connexion',
        details: null
      };
    }
  };

  return { request, handleApiError };
};

// Configuration des URLs des APIs
// Priorité : window.healthtrackConfig (injecté via /config.js après déploiement AWS)
// Sinon fallback sur les chemins relatifs (proxy Vite en dev local)
const getApiUrls = () => {
  const config = (typeof window !== 'undefined' && window.healthtrackConfig) || {};

  return {
    utilisateurs: config.API_UTILISATEURS_URL || '/api-utilisateurs',
    rdv: config.API_RDV_URL || '/api-rdv',
    dossiers: config.API_DOSSIERS_URL || '/api-dossiers',
    ordonnances: config.API_ORDONNANCES_URL || '/api-ordonnances'
  };
};

// Export des URLs
export const API_URLS = getApiUrls();

// Clients API spécialisés

// Client pour l'API Utilisateurs
export const createUtilisateursClient = (token = null) => {
  return createApiClient(API_URLS.utilisateurs, token);
};

// Client pour l'API RDV/Disponibilités
export const createRdvClient = (token = null) => {
  return createApiClient(API_URLS.rdv, token);
};

// Client pour l'API Dossiers Médicaux
export const createDossiersClient = (token = null) => {
  return createApiClient(API_URLS.dossiers, token);
};

// Client pour l'API Ordonnances
export const createOrdonnancesClient = (token = null) => {
  return createApiClient(API_URLS.ordonnances, token);
};

export default {
  createApiClient,
  useApi,
  useApiRequest,
  API_URLS
};
