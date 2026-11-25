/**
 * Page Dossier Médical (Patient)
 * Consultation et modification du dossier médical (antécédents, allergies, vaccinations)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../services/auth';
import { API_URLS } from '../../services/api';
import axios from 'axios';

function DossierMedicalPage() {
  const { user, token } = useAuth();
  const [dossier, setDossier] = useState(null);
  const [antecedents, setAntecedents] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('antecedents');

  // Formulaire nouvel antécédent
  const [newAntecedent, setNewAntecedent] = useState({ type: 'PONCTUEL', description: '', date: '' });
  // Formulaire nouvelle allergie
  const [newAllergie, setNewAllergie] = useState({ nom: '', severite: 'LEGERE' });
  // Formulaire nouvelle vaccination
  const [newVaccination, setNewVaccination] = useState({ vaccin: '', dateAdministration: '', lot: '' });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchDossier = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URLS.dossiers}/patients/${user.userId}/dossier`,
        { headers }
      );
      setDossier(res.data.dossier);
      setAntecedents(res.data.antecedents || []);
      setAllergies(res.data.allergies || []);
      setVaccinations(res.data.vaccinations || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du chargement du dossier');
    } finally {
      setLoading(false);
    }
  }, [user, token]);

  useEffect(() => {
    fetchDossier();
  }, [fetchDossier]);

  const handleAddAntecedent = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API_URLS.dossiers}/dossiers/${user.userId}/antecedents`,
        newAntecedent,
        { headers }
      );
      setNewAntecedent({ type: 'PONCTUEL', description: '', date: '' });
      fetchDossier();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    }
  };

  const handleArchiveAntecedent = async (antecedentId) => {
    try {
      await axios.post(
        `${API_URLS.dossiers}/antecedents/${antecedentId}/archiver`,
        {},
        { headers }
      );
      fetchDossier();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'archivage');
    }
  };

  const handleAddAllergie = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API_URLS.dossiers}/dossiers/${user.userId}/allergies`,
        newAllergie,
        { headers }
      );
      setNewAllergie({ nom: '', severite: 'LEGERE' });
      fetchDossier();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    }
  };

  const handleDeleteAllergie = async (allergieId) => {
    if (!window.confirm('Supprimer cette allergie ?')) return;
    try {
      await axios.delete(`${API_URLS.dossiers}/allergies/${allergieId}`, { headers });
      fetchDossier();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleAddVaccination = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API_URLS.dossiers}/dossiers/${user.userId}/vaccinations`,
        newVaccination,
        { headers }
      );
      setNewVaccination({ vaccin: '', dateAdministration: '', lot: '' });
      fetchDossier();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    }
  };

  if (loading) return <div className="page"><div className="loading">Chargement du dossier médical...</div></div>;

  return (
    <div className="page dossier-medical-page">
      <div className="page-header">
        <h1>Mon dossier médical</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {dossier && (
        <div className="dossier-info">
          <p><strong>Groupe sanguin :</strong> {dossier.groupeSanguin || 'Non renseigné'}</p>
          <p><strong>Créé le :</strong> {dossier.dateCreation ? new Date(dossier.dateCreation).toLocaleDateString('fr-FR') : '—'}</p>
        </div>
      )}

      <div className="tabs">
        {['antecedents', 'allergies', 'vaccinations'].map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'antecedents' ? 'Antécédents' : tab === 'allergies' ? 'Allergies' : 'Vaccinations'}
            ({tab === 'antecedents' ? antecedents.length : tab === 'allergies' ? allergies.length : vaccinations.length})
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'antecedents' && (
          <div>
            <form className="inline-form" onSubmit={handleAddAntecedent}>
              <select value={newAntecedent.type} onChange={e => setNewAntecedent({ ...newAntecedent, type: e.target.value })}>
                <option value="PONCTUEL">Ponctuel</option>
                <option value="CHRONIQUE">Chronique</option>
              </select>
              <input
                type="text"
                placeholder="Description"
                value={newAntecedent.description}
                onChange={e => setNewAntecedent({ ...newAntecedent, description: e.target.value })}
                required
              />
              <input
                type="date"
                value={newAntecedent.date}
                onChange={e => setNewAntecedent({ ...newAntecedent, date: e.target.value })}
              />
              <button type="submit" className="btn btn-primary btn-small">Ajouter</button>
            </form>

            <ul className="items-list">
              {antecedents.map(a => (
                <li key={a.antecedentId} className={`item ${a.statut === 'ARCHIVE' ? 'archived' : ''}`}>
                  <span className="item-type">{a.type}</span>
                  <span className="item-desc">{a.description}</span>
                  <span className="item-date">{a.date ? new Date(a.date).toLocaleDateString('fr-FR') : ''}</span>
                  <span className="item-status">{a.statut}</span>
                  {a.statut === 'ACTIF' && a.type !== 'CHRONIQUE' && (
                    <button className="btn btn-small btn-warning" onClick={() => handleArchiveAntecedent(a.antecedentId)}>
                      Archiver
                    </button>
                  )}
                </li>
              ))}
              {antecedents.length === 0 && <li className="empty">Aucun antécédent</li>}
            </ul>
          </div>
        )}

        {activeTab === 'allergies' && (
          <div>
            <form className="inline-form" onSubmit={handleAddAllergie}>
              <input
                type="text"
                placeholder="Nom de l'allergie (ex: Pénicilline)"
                value={newAllergie.nom}
                onChange={e => setNewAllergie({ ...newAllergie, nom: e.target.value })}
                required
              />
              <select value={newAllergie.severite} onChange={e => setNewAllergie({ ...newAllergie, severite: e.target.value })}>
                <option value="LEGERE">Légère</option>
                <option value="MODEREE">Modérée</option>
                <option value="SEVERE">Sévère</option>
              </select>
              <button type="submit" className="btn btn-primary btn-small">Ajouter</button>
            </form>

            <ul className="items-list">
              {allergies.map(a => (
                <li key={a.allergieId} className="item allergie">
                  <span className="item-desc">{a.nom}</span>
                  <span className={`severite severite-${a.severite?.toLowerCase()}`}>{a.severite}</span>
                  <button className="btn btn-small btn-danger" onClick={() => handleDeleteAllergie(a.allergieId)}>
                    Supprimer
                  </button>
                </li>
              ))}
              {allergies.length === 0 && <li className="empty">Aucune allergie</li>}
            </ul>
          </div>
        )}

        {activeTab === 'vaccinations' && (
          <div>
            <form className="inline-form" onSubmit={handleAddVaccination}>
              <input
                type="text"
                placeholder="Nom du vaccin"
                value={newVaccination.vaccin}
                onChange={e => setNewVaccination({ ...newVaccination, vaccin: e.target.value })}
                required
              />
              <input
                type="date"
                value={newVaccination.dateAdministration}
                onChange={e => setNewVaccination({ ...newVaccination, dateAdministration: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Lot"
                value={newVaccination.lot}
                onChange={e => setNewVaccination({ ...newVaccination, lot: e.target.value })}
              />
              <button type="submit" className="btn btn-primary btn-small">Ajouter</button>
            </form>

            <ul className="items-list">
              {vaccinations.map(v => (
                <li key={v.vaccinationId} className="item">
                  <span className="item-desc">{v.vaccin}</span>
                  <span className="item-date">{v.dateAdministration ? new Date(v.dateAdministration).toLocaleDateString('fr-FR') : ''}</span>
                  {v.lot && <span className="item-lot">Lot: {v.lot}</span>}
                </li>
              ))}
              {vaccinations.length === 0 && <li className="empty">Aucune vaccination</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default DossierMedicalPage;
