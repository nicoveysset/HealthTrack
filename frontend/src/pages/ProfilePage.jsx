/**
 * Page de profil
 * - Tous : consultation et modification de son profil (PATCH /utilisateurs/me)
 * - Praticien : changement de statut ACTIF / EN_CONGE / INACTIF (PATCH /praticiens/me/statut)
 * - Patient : désignation / modification du médecin traitant (PUT /patients/me/medecin-traitant)
 */
import React, { useState, useEffect } from 'react';
import { useAuth, Role } from '../services/auth';
import { API_URLS } from '../services/api';
import { apiError, formatDate, formatDateTime, SPECIALITES, STATUTS_PRATICIEN } from '../utils/format';
import axios from 'axios';

function ProfilePage() {
  const { user, token, updateProfile, setCurrentUser } = useAuth();
  const [formData, setFormData] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generalistes, setGeneralistes] = useState([]);
  const [medecinTraitant, setMedecinTraitant] = useState(null);
  const [choixMedecin, setChoixMedecin] = useState('');

  const headers = { Authorization: `Bearer ${token}` };
  const isPraticien = user?.type === Role.PRATICIEN;

  useEffect(() => { if (user) setFormData(user); }, [user]);

  // Patient : liste des généralistes et nom du médecin traitant actuel
  useEffect(() => {
    if (!user || isPraticien) return;
    axios.get(`${API_URLS.utilisateurs}/praticiens`, { headers, params: { specialite: 'GENERALISTE', limit: 100 } })
      .then(res => setGeneralistes(res.data.items || [])).catch(() => {});
    if (user.medecinTraitantId) {
      axios.get(`${API_URLS.utilisateurs}/utilisateurs/${user.medecinTraitantId}`, { headers })
        .then(res => setMedecinTraitant(res.data)).catch(() => setMedecinTraitant(null));
    } else {
      setMedecinTraitant(null);
    }
  }, [user?.medecinTraitantId, isPraticien, token]);

  const notify = (msg) => { setSuccess(msg); setError(null); setTimeout(() => setSuccess(null), 3000); };

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload = { firstName: formData.firstName, lastName: formData.lastName };
      if (isPraticien) Object.assign(payload, { specialite: formData.specialite, rpps: formData.rpps });
      else Object.assign(payload, { dateNaissance: formData.dateNaissance, nss: formData.nss });
      await updateProfile(payload);
      setEditMode(false);
      notify('Profil mis à jour.');
    } catch (err) {
      setError(apiError(err, 'Erreur lors de la mise à jour du profil'));
    } finally {
      setSaving(false);
    }
  };

  const changerStatut = async (statut) => {
    if (statut === user.statut) return;
    if (statut !== 'ACTIF' && !window.confirm(`Passer en statut « ${STATUTS_PRATICIEN[statut]} » ? Vous ne pourrez plus recevoir de rendez-vous.`)) return;
    try {
      const res = await axios.patch(`${API_URLS.utilisateurs}/praticiens/me/statut`, { statut }, { headers });
      setCurrentUser(res.data);
      notify(`Statut : ${STATUTS_PRATICIEN[statut]}`);
    } catch (err) {
      setError(apiError(err));
    }
  };

  const designerMedecin = async () => {
    if (!choixMedecin) return;
    try {
      const res = await axios.put(`${API_URLS.utilisateurs}/patients/me/medecin-traitant`,
        { medecinTraitantId: choixMedecin }, { headers });
      setCurrentUser(res.data);
      setChoixMedecin('');
      notify('Médecin traitant enregistré.');
    } catch (err) {
      // InvalidSpecialityException (non généraliste) ou PractitionerNotAvailableException (INACTIF)
      setError(apiError(err));
    }
  };

  if (!user) return <div className="alert alert-error">Profil non trouvé</div>;

  const field = (label, name, view, input) => (
    <div className="form-group">
      <label>{label}</label>
      {editMode && input ? input : <div className="form-value">{view || '—'}</div>}
    </div>
  );

  return (
    <div className="page profile-page">
      <div className="page-header">
        <h1>Mon profil</h1>
        {!editMode ? (
          <button className="btn btn-secondary" onClick={() => setEditMode(true)}>Modifier</button>
        ) : (
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button className="btn btn-cancel" onClick={() => { setEditMode(false); setFormData(user); setError(null); }}>
              Annuler
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-row">
          {field('Type de compte', null, isPraticien ? 'Praticien' : 'Patient')}
          {field('Email', null, user.email)}
        </div>
        <div className="form-row">
          {field('Prénom', 'firstName', user.firstName,
            <input type="text" name="firstName" value={formData.firstName || ''} onChange={handleChange} required />)}
          {field('Nom', 'lastName', user.lastName,
            <input type="text" name="lastName" value={formData.lastName || ''} onChange={handleChange} required />)}
        </div>

        {isPraticien && (
          <>
            <h2>Informations professionnelles</h2>
            <div className="form-row">
              {field('Spécialité', 'specialite', SPECIALITES[user.specialite] || user.specialite,
                <select name="specialite" value={formData.specialite || ''} onChange={handleChange}>
                  {Object.entries(SPECIALITES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>)}
              {field('N° RPPS', 'rpps', user.rpps,
                <input type="text" name="rpps" value={formData.rpps || ''} onChange={handleChange} />)}
            </div>
          </>
        )}

        {!isPraticien && (
          <>
            <h2>Informations personnelles</h2>
            <div className="form-row">
              {field('Date de naissance', 'dateNaissance', formatDate(user.dateNaissance),
                <input type="date" name="dateNaissance" value={formData.dateNaissance || ''} onChange={handleChange} />)}
              {field('N° de sécurité sociale', 'nss', user.nss,
                <input type="text" name="nss" value={formData.nss || ''} onChange={handleChange} />)}
            </div>
          </>
        )}

        <div className="form-row">
          {field('Compte créé le', null, formatDateTime(user.createdAt))}
          {field('Dernière mise à jour', null, formatDateTime(user.updatedAt))}
        </div>
      </form>

      {isPraticien && (
        <div className="profile-section">
          <h2>Statut</h2>
          <p className="hint">En congé ou inactif, vous ne pouvez plus recevoir de rendez-vous.</p>
          <div className="statut-switch">
            {Object.entries(STATUTS_PRATICIEN).map(([v, l]) => (
              <button key={v} type="button" className={`btn btn-small ${user.statut === v ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => changerStatut(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isPraticien && (
        <div className="profile-section">
          <h2>Médecin traitant</h2>
          <p>
            {medecinTraitant
              ? <>Actuel : <strong>Dr {medecinTraitant.firstName} {medecinTraitant.lastName}</strong>
                  {medecinTraitant.statut !== 'ACTIF' && <small> ({STATUTS_PRATICIEN[medecinTraitant.statut]})</small>}</>
              : 'Aucun médecin traitant désigné.'}
          </p>
          <div className="inline-form">
            <select value={choixMedecin} onChange={e => setChoixMedecin(e.target.value)}>
              <option value="">— Choisir un médecin généraliste —</option>
              {generalistes.filter(g => g.userId !== user.medecinTraitantId).map(g => (
                <option key={g.userId} value={g.userId}>
                  Dr {g.firstName} {g.lastName}{g.statut !== 'ACTIF' ? ` (${STATUTS_PRATICIEN[g.statut]})` : ''}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-small" disabled={!choixMedecin} onClick={designerMedecin}>
              {user.medecinTraitantId ? 'Changer' : 'Désigner'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
