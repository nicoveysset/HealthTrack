/**
 * Page de profil utilisateur
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/auth';
import { Role } from '../services/auth';

/**
 * Page de profil
 */
function ProfilePage() {
  const { user, getProfile, updateProfile, loading, error } = useAuth();
  const [formData, setFormData] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);

  // Charger le profil au montage
  useEffect(() => {
    if (user) {
      setFormData(user);
    } else {
      getProfile();
    }
  }, [user, getProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);
    setUpdateError(null);

    try {
      await updateProfile(formData);
      setEditMode(false);
    } catch (err) {
      setUpdateError(err.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Chargement du profil...</div>;
  }

  if (!user) {
    return <div className="alert alert-error">Profil non trouvé</div>;
  }

  return (
    <div className="page profile-page">
      <div className="page-header">
        <h1>Mon profil</h1>
        
        {!editMode ? (
          <button 
            className="btn btn-secondary" 
            onClick={() => setEditMode(true)}
          >
            Modifier
          </button>
        ) : (
          <>
            <button 
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={updateLoading}
            >
              {updateLoading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button 
              className="btn btn-cancel" 
              onClick={() => {
                setEditMode(false);
                setFormData(user);
              }}
            >
              Annuler
            </button>
          </>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {updateError && <div className="alert alert-error">{updateError}</div>}

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-row">
          <div className="form-group">
            <label>Type de compte</label>
            <div className="form-value">
              {user.type === Role.PRATICIEN ? 'Praticien' : 'Patient'}
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            {editMode ? (
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                disabled
              />
            ) : (
              <div className="form-value">{user.email}</div>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Prénom</label>
            {editMode ? (
              <input
                type="text"
                name="firstName"
                value={formData.firstName || ''}
                onChange={handleChange}
              />
            ) : (
              <div className="form-value">{user.firstName}</div>
            )}
          </div>
          
          <div className="form-group">
            <label>Nom</label>
            {editMode ? (
              <input
                type="text"
                name="lastName"
                value={formData.lastName || ''}
                onChange={handleChange}
              />
            ) : (
              <div className="form-value">{user.lastName}</div>
            )}
          </div>
        </div>

        {/* Champs spécifiques aux praticiens */}
        {user.type === Role.PRATICIEN && (
          <>
            <h2>Informations professionnelles</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>Spécialité</label>
                {editMode ? (
                  <input
                    type="text"
                    name="specialite"
                    value={formData.specialite || ''}
                    onChange={handleChange}
                  />
                ) : (
                  <div className="form-value">{user.specialite}</div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>RPPS</label>
                {editMode ? (
                  <input
                    type="text"
                    name="rpps"
                    value={formData.rpps || ''}
                    onChange={handleChange}
                  />
                ) : (
                  <div className="form-value">{user.rpps}</div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Statut</label>
                {editMode ? (
                  <select
                    name="statut"
                    value={formData.statut || ''}
                    onChange={handleChange}
                  >
                    <option value="ACTIF">Actif</option>
                    <option value="EN_CONGE">En congé</option>
                    <option value="INACTIF">Inactif</option>
                  </select>
                ) : (
                  <div className="form-value">{user.statut}</div>
                )}
              </div>
            </div>

            {editMode && (
              <div className="form-group">
                <label>Médecin traitant (pour les patients qui vous ont choisi)</label>
                <div className="form-value">
                  {user.medecinTraitantId ? 'Oui' : 'Non'}
                </div>
              </div>
            )}
          </>
        )}

        {/* Champs spécifiques aux patients */}
        {user.type === Role.PATIENT && (
          <>
            <h2>Informations personnelles</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>Date de naissance</label>
                {editMode ? (
                  <input
                    type="date"
                    name="dateNaissance"
                    value={formData.dateNaissance || ''}
                    onChange={handleChange}
                  />
                ) : (
                  <div className="form-value">{user.dateNaissance}</div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Numéro de sécurité sociale</label>
                {editMode ? (
                  <input
                    type="text"
                    name="nss"
                    value={formData.nss || ''}
                    onChange={handleChange}
                  />
                ) : (
                  <div className="form-value">{user.nss}</div>
                )}
              </div>
            </div>

            {user.medecinTraitantId && (
              <div className="form-row">
                <div className="form-group">
                  <label>Médecin traitant</label>
                  <div className="form-value">
                    ID: {user.medecinTraitantId}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Date de création du compte</label>
            <div className="form-value">{user.createdAt}</div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Dernière mise à jour</label>
            <div className="form-value">{user.updatedAt}</div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default ProfilePage;
