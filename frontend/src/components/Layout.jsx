/**
 * Layout principal de l'application
 * Contient le header, la navigation et le footer
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { Role } from '../services/auth';

/**
 * Composant Layout
 */
function Layout({ children }) {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  // Vérifier si on est sur une page publique (login/register)
  const isPublicPage = location.pathname === '/login' || location.pathname === '/register';

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Link to="/">HealthTrack</Link>
          </div>
          
          {isAuthenticated() && (
            <nav className="navigation">
              <Link to="/">Accueil</Link>
              <Link to="/profile">Mon profil</Link>
              
              {user?.type === Role.PRATICIEN && (
                <>
                  <Link to="/agenda">Mon agenda</Link>
                  <Link to="/disponibilites">Disponibilités</Link>
                </>
              )}
              
              {user?.type === Role.PATIENT && (
                <>
                  <Link to="/prise-rdv">Prendre un RDV</Link>
                  <Link to="/dossier-medical">Mon dossier médical</Link>
                </>
              )}
            </nav>
          )}
          
          <div className="auth-actions">
            {isAuthenticated() ? (
              <button onClick={logout} className="btn btn-logout">
                Déconnexion
              </button>
            ) : (
              <>
                <Link to="/login" className="btn">Connexion</Link>
                <Link to="/register" className="btn btn-primary">
                  Inscription
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">{children}</main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>&copy; {new Date().getFullYear()} HealthTrack. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
