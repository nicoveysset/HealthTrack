/**
 * Page d'accueil
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { Role } from '../services/auth';

/**
 * Page d'accueil
 */
function HomePage() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated()) {
    return (
      <div className="page home-page">
        <div className="hero">
          <h1>Bienvenue sur HealthTrack</h1>
          <p className="subtitle">
            La solution complète pour la gestion de votre cabinet médical
          </p>
          
          <div className="hero-actions">
            <Link to="/login" className="btn btn-primary btn-large">
              Se connecter
            </Link>
            <Link to="/register" className="btn btn-secondary btn-large">
              S'inscrire
            </Link>
          </div>
        </div>

        <div className="features">
          <div className="feature">
            <h3>Pour les patients</h3>
            <p>Prendre des rendez-vous, consulter votre dossier médical, gérer vos ordonnances</p>
          </div>
          
          <div className="feature">
            <h3>Pour les praticiens</h3>
            <p>Gérer votre agenda, vos disponibilités, rédiger des comptes rendus et ordonnances</p>
          </div>
          
          <div className="feature">
            <h3>Sécurisé et confidentiel</h3>
            <p>Vos données sont protégées et accessibles uniquement aux personnes autorisées</p>
          </div>
        </div>
      </div>
    );
  }

  // Utilisateur connecté
  return (
    <div className="page home-page">
      <div className="welcome">
        <h1>Bonjour, {user.firstName} {user.lastName} !</h1>
        
        {user.type === Role.PRATICIEN && (
          <div className="praticien-dashboard">
            <h2>Votre espace praticien</h2>
            <div className="quick-actions">
              <Link to="/agenda" className="action-card">
                <h3>Agenda</h3>
                <p>Consultez vos rendez-vous du jour</p>
              </Link>
              
              <Link to="/disponibilites" className="action-card">
                <h3>Disponibilités</h3>
                <p>Gérez vos créneaux disponibles</p>
              </Link>
              
              <Link to="/profile" className="action-card">
                <h3>Profil</h3>
                <p>Modifiez vos informations</p>
              </Link>
            </div>
          </div>
        )}

        {user.type === Role.PATIENT && (
          <div className="patient-dashboard">
            <h2>Votre espace patient</h2>
            <div className="quick-actions">
              <Link to="/prise-rdv" className="action-card">
                <h3>Prendre un RDV</h3>
                <p>Trouvez un créneau disponible</p>
              </Link>
              
              <Link to="/dossier-medical" className="action-card">
                <h3>Dossier médical</h3>
                <p>Consultez votre historique</p>
              </Link>
              
              <Link to="/profile" className="action-card">
                <h3>Profil</h3>
                <p>Modifiez vos informations</p>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HomePage;
