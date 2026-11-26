/**
 * Layout principal de l'application
 * Contient le header, la navigation et le footer
 */
import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
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
            <Link to="/">Health<span className="logo-accent">Track</span></Link>
          </div>
          
          {isAuthenticated() && (
            <nav className="navigation">
              <NavLink to="/" end>Accueil</NavLink>
              <NavLink to="/profile">Mon profil</NavLink>
              
              {user?.type === Role.PRATICIEN && (
                <>
                  <NavLink to="/agenda">Mon agenda</NavLink>
                  <NavLink to="/disponibilites">Disponibilités</NavLink>
                </>
              )}
              
              {user?.type === Role.PATIENT && (
                <>
                  <NavLink to="/prise-rdv">Prendre un RDV</NavLink>
                  <NavLink to="/mes-rendezvous">Mes rendez-vous</NavLink>
                  <NavLink to="/mes-ordonnances">Mes ordonnances</NavLink>
                  <NavLink to="/dossier-medical">Mon dossier</NavLink>
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
