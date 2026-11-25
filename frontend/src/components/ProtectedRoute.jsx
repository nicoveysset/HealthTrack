/**
 * Route protégée - Requiert une authentification
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../services/auth';

/**
 * Composant ProtectedRoute
 * Redirige vers /login si l'utilisateur n'est pas authentifié
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (!isAuthenticated()) {
    // Rediriger vers /login avec l'URL de retour
    return <Navigate to={`/login?from=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
