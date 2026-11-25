/**
 * Page 404 - Non trouvée
 */
import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Page 404
 */
function NotFoundPage() {
  return (
    <div className="page not-found-page">
      <div className="not-found-content">
        <h1>404</h1>
        <h2>Page non trouvée</h2>
        <p>La page que vous cherchez n'existe pas ou a été déplacée.</p>
        
        <div className="not-found-actions">
          <Link to="/" className="btn btn-primary">
            Retour à l'accueil
          </Link>
          
          <Link to="/login" className="btn btn-secondary">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
