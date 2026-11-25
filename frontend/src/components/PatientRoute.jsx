/**
 * Route Patient - Requiert le rôle PATIENT
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { Role } from '../services/auth';

/**
 * Composant PatientRoute
 * Redirige vers / si l'utilisateur n'est pas un patient
 */
function PatientRoute({ children }) {
  const { hasRole, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (!isAuthenticated() || !hasRole(Role.PATIENT)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default PatientRoute;
