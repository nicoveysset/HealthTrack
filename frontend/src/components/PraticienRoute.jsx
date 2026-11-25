/**
 * Route Praticien - Requiert le rôle PRATICIEN
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { Role } from '../services/auth';

/**
 * Composant PraticienRoute
 * Redirige vers / si l'utilisateur n'est pas un praticien
 */
function PraticienRoute({ children }) {
  const { hasRole, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (!isAuthenticated() || !hasRole(Role.PRATICIEN)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default PraticienRoute;
