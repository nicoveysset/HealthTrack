/**
 * Page d'inscription
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { Role } from '../services/auth';
import { SPECIALITES, apiError } from '../utils/format';

/**
 * Page d'inscription
 */
function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    type: Role.PATIENT,
    firstName: '',
    lastName: '',
    // Champs spécifiques aux praticiens
    specialite: '',
    rpps: '',
    // Champs spécifiques aux patients
    dateNaissance: '',
    nss: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Rediriger si déjà connecté
  useEffect(() => {
    if (isAuthenticated()) {
      const from = location.state?.from || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Préparer les données selon le type
      const userData = {
        email: formData.email,
        password: formData.password,
        type: formData.type,
        firstName: formData.firstName,
        lastName: formData.lastName
      };

      // Ajouter les champs spécifiques aux praticiens
      if (formData.type === Role.PRATICIEN) {
        userData.specialite = formData.specialite;
        userData.rpps = formData.rpps;
      }

      // Ajouter les champs spécifiques aux patients
      if (formData.type === Role.PATIENT) {
        userData.dateNaissance = formData.dateNaissance;
        userData.nss = formData.nss;
      }

      await register(userData);
      
      // Rediriger vers la page précédente ou la page d'accueil
      const from = location.state?.from || '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiError(err, "Erreur lors de l'inscription"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>Inscription</h1>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="type">Type de compte</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
            >
              <option value={Role.PATIENT}>Patient</option>
              <option value={Role.PRATICIEN}>Praticien</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="votre@email.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe (min. 8 caractères)</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Votre mot de passe"
              minLength={8}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">Prénom</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="Votre prénom"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="lastName">Nom</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="Votre nom"
              />
            </div>
          </div>

          {/* Champs spécifiques aux praticiens */}
          {formData.type === Role.PRATICIEN && (
            <>
              <div className="form-group">
                <label htmlFor="specialite">Spécialité</label>
                <select
                  id="specialite"
                  name="specialite"
                  value={formData.specialite}
                  onChange={handleChange}
                  required
                >
                  <option value="">— Choisir —</option>
                  {Object.entries(SPECIALITES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="rpps">RPPS (fictif)</label>
                <input
                  type="text"
                  id="rpps"
                  name="rpps"
                  value={formData.rpps}
                  onChange={handleChange}
                  required
                  placeholder="Votre RPPS"
                />
              </div>
            </>
          )}

          {/* Champs spécifiques aux patients */}
          {formData.type === Role.PATIENT && (
            <>
              <div className="form-group">
                <label htmlFor="dateNaissance">Date de naissance</label>
                <input
                  type="date"
                  id="dateNaissance"
                  name="dateNaissance"
                  value={formData.dateNaissance}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="nss">Numéro de sécurité sociale (fictif)</label>
                <input
                  type="text"
                  id="nss"
                  name="nss"
                  value={formData.nss}
                  onChange={handleChange}
                  required
                  placeholder="Votre NSS"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'Inscription en cours...' : "S'inscrire"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Vous avez déjà un compte ? <a href="/login">Se connecter</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
