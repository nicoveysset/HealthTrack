/**
 * Service d'authentification HealthTrack
 * Gère la connexion, l'inscription et la gestion du token JWT
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Rôles des utilisateurs
export const Role = {
  PATIENT: 'PATIENT',
  PRATICIEN: 'PRATICIEN',
  ADMIN: 'ADMIN'
};

// Contexte d'authentification
const AuthContext = createContext(null);

// Récupérer la configuration (window.healthtrackConfig injecté via /config.js)
const getConfig = () => {
  return (typeof window !== 'undefined' && window.healthtrackConfig) || {
    API_UTILISATEURS_URL: '/api-utilisateurs'
  };
};

/**
 * Fournisseur d'authentification
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger l'utilisateur depuis le localStorage au démarrage
  useEffect(() => {
    const loadUser = () => {
      try {
        const storedUser = localStorage.getItem('healthtrack_user');
        const storedToken = localStorage.getItem('healthtrack_token');
        
        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
        }
      } catch (err) {
        console.error('Erreur lors du chargement de l\'utilisateur :', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, []);

  // Sauvegarder l'utilisateur et le token
  const saveUser = useCallback((user, token) => {
    localStorage.setItem('healthtrack_user', JSON.stringify(user));
    localStorage.setItem('healthtrack_token', token);
    setUser(user);
    setToken(token);
    setError(null);
  }, []);

  // Déconnecter l'utilisateur
  const logout = useCallback(() => {
    localStorage.removeItem('healthtrack_user');
    localStorage.removeItem('healthtrack_token');
    setUser(null);
    setToken(null);
    setError(null);
  }, []);

  // S'inscrire
  const register = async (userData) => {
    setLoading(true);
    setError(null);
    
    try {
      const config = getConfig();
      const response = await axios.post(
        `${config.API_UTILISATEURS_URL}/auth/register`,
        userData
      );
      
      const { user, token } = response.data;
      saveUser(user, token);
      
      setLoading(false);
      return user;
    } catch (err) {
      handleAuthError(err);
      setLoading(false);
      throw err;
    }
  };

  // Se connecter
  const login = async (credentials) => {
    setLoading(true);
    setError(null);
    
    try {
      const config = getConfig();
      const response = await axios.post(
        `${config.API_UTILISATEURS_URL}/auth/login`,
        credentials
      );
      
      const { user, token } = response.data;
      saveUser(user, token);
      
      setLoading(false);
      return user;
    } catch (err) {
      handleAuthError(err);
      setLoading(false);
      throw err;
    }
  };

  // Récupérer le profil
  const getProfile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const config = getConfig();
      const response = await axios.get(
        `${config.API_UTILISATEURS_URL}/utilisateurs/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      setUser(response.data);
      setLoading(false);
      return response.data;
    } catch (err) {
      handleAuthError(err);
      setLoading(false);
      throw err;
    }
  };

  // Mettre à jour le profil
  const updateProfile = async (updates) => {
    setLoading(true);
    setError(null);
    
    try {
      const config = getConfig();
      const response = await axios.patch(
        `${config.API_UTILISATEURS_URL}/utilisateurs/me`,
        updates,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      setUser(response.data);
      localStorage.setItem('healthtrack_user', JSON.stringify(response.data));
      
      setLoading(false);
      return response.data;
    } catch (err) {
      handleAuthError(err);
      setLoading(false);
      throw err;
    }
  };

  // Remplacer l'utilisateur courant (après une mise à jour faite par une autre route)
  const setCurrentUser = useCallback((updated) => {
    setUser(updated);
    localStorage.setItem('healthtrack_user', JSON.stringify(updated));
  }, []);

  // Gérer les erreurs d'authentification
  const handleAuthError = (err) => {
    if (err.response) {
      const { status, data } = err.response;
      
      let errorMessage = 'Une erreur est survenue';
      
      if (status === 400) {
        errorMessage = data.message || 'Données invalides';
      } else if (status === 401) {
        errorMessage = 'Email ou mot de passe incorrect';
        logout();
      } else if (status === 403) {
        errorMessage = 'Non autorisé';
      } else if (status === 404) {
        errorMessage = 'Ressource non trouvée';
      } else if (status === 409) {
        errorMessage = data.message || 'Conflit';
      }
      
      setError(errorMessage);
    } else if (err.request) {
      setError('Pas de réponse du serveur');
    } else {
      setError('Erreur de connexion');
    }
  };

  // Vérifier si l'utilisateur est authentifié
  const isAuthenticated = useCallback(() => {
    return !!user && !!token;
  }, [user, token]);

  // Vérifier si l'utilisateur a un rôle spécifique
  const hasRole = useCallback((role) => {
    return user?.type === role;
  }, [user]);

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    hasRole,
    register,
    login,
    logout,
    getProfile,
    updateProfile,
    setCurrentUser,
    setError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personnalisé pour accéder au contexte d'authentification
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  
  return context;
};

export default AuthContext;
