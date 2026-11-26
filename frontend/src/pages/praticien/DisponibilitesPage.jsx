/**
 * Page Disponibilités (Praticien)
 * Gère les disponibilités hebdomadaires et les indisponibilités ponctuelles
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../services/auth';
import { API_URLS } from '../../services/api';
import { apiError, formatDateTime } from '../../utils/format';
import axios from 'axios';

const JOURS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];

function DisponibilitesPage() {
  const { token } = useAuth();
  const [disponibilites, setDisponibilites] = useState([]);
  const [indisponibilites, setIndisponibilites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('dispos');

  // Formulaire nouvelle dispo
  const [newDispo, setNewDispo] = useState({ jourSemaine: 'LUNDI', heureDebut: '09:00', heureFin: '17:00' });
  // Formulaire nouvelle indispo
  const [newIndispo, setNewIndispo] = useState({ dateDebut: '', dateFin: '', motif: '' });
  const [dirty, setDirty] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [disposRes, indisposRes] = await Promise.all([
        axios.get(`${API_URLS.rdv}/praticiens/me/disponibilites`, { headers }),
        axios.get(`${API_URLS.rdv}/praticiens/me/indisponibilites`, { headers })
      ]);
      setDisponibilites(Array.isArray(disposRes.data) ? disposRes.data : (disposRes.data.items || []));
      setIndisponibilites(Array.isArray(indisposRes.data) ? indisposRes.data : (indisposRes.data.items || []));
      setError(null);
    } catch (err) {
      setError(apiError(err, 'Erreur de chargement'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveDispos = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await axios.put(
        `${API_URLS.rdv}/praticiens/me/disponibilites`,
        { disponibilites: disponibilites.map(({ jourSemaine, heureDebut, heureFin }) => ({ jourSemaine, heureDebut, heureFin })) },
        { headers }
      );
      setSuccess('Disponibilités enregistrées !');
      setDirty(false);
      fetchData();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddDispo = () => {
    setDisponibilites([...disponibilites, { ...newDispo, dispoId: `tmp-${Date.now()}` }]);
    setDirty(true);
    setNewDispo({ jourSemaine: 'LUNDI', heureDebut: '09:00', heureFin: '17:00' });
  };

  const handleRemoveDispo = (id) => {
    setDisponibilites(disponibilites.filter(d => d.dispoId !== id));
    setDirty(true);
  };

  const handleAddIndispo = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API_URLS.rdv}/praticiens/me/indisponibilites`,
        {
          dateDebut: newIndispo.dateDebut,
          dateFin: newIndispo.dateFin,
          motif: newIndispo.motif
        },
        { headers }
      );
      setNewIndispo({ dateDebut: '', dateFin: '', motif: '' });
      setSuccess('Indisponibilité ajoutée !');
      fetchData();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const handleDeleteIndispo = async (indispoId) => {
    if (!window.confirm('Supprimer cette indisponibilité ?')) return;
    try {
      await axios.delete(`${API_URLS.rdv}/praticiens/me/indisponibilites/${indispoId}`, { headers });
      fetchData();
    } catch (err) {
      setError(apiError(err));
    }
  };

  if (loading && disponibilites.length === 0) return <div className="page"><div className="loading">Chargement...</div></div>;

  return (
    <div className="page disponibilites-page">
      <div className="page-header">
        <h1>Mes disponibilités</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="tabs">
        <button className={`tab ${activeTab === 'dispos' ? 'active' : ''}`} onClick={() => setActiveTab('dispos')}>
          Disponibilités hebdo ({disponibilites.length})
        </button>
        <button className={`tab ${activeTab === 'indispos' ? 'active' : ''}`} onClick={() => setActiveTab('indispos')}>
          Indisponibilités ({indisponibilites.length})
        </button>
      </div>

      {activeTab === 'dispos' && (
        <div className="tab-content">
          <div className="inline-form">
            <select value={newDispo.jourSemaine} onChange={e => setNewDispo({ ...newDispo, jourSemaine: e.target.value })}>
              {JOURS.map(j => <option key={j} value={j}>{j.charAt(0) + j.slice(1).toLowerCase()}</option>)}
            </select>
            <input type="time" value={newDispo.heureDebut} onChange={e => setNewDispo({ ...newDispo, heureDebut: e.target.value })} />
            <span>à</span>
            <input type="time" value={newDispo.heureFin} onChange={e => setNewDispo({ ...newDispo, heureFin: e.target.value })} />
            <button className="btn btn-primary btn-small" onClick={handleAddDispo}>Ajouter</button>
          </div>

          <ul className="items-list">
            {disponibilites.map(d => (
              <li key={d.dispoId} className="item">
                <span className="item-day">{d.jourSemaine}</span>
                <span className="item-hours">{d.heureDebut} - {d.heureFin}</span>
                <button className="btn btn-small btn-danger" onClick={() => handleRemoveDispo(d.dispoId)}>✕</button>
              </li>
            ))}
            {disponibilites.length === 0 && <li className="empty">Aucune disponibilité définie</li>}
          </ul>

          <button className="btn btn-success" onClick={handleSaveDispos} disabled={loading}>
            Enregistrer les disponibilités
          </button>
          {dirty && <span className="hint"> Modifications non enregistrées</span>}
        </div>
      )}

      {activeTab === 'indispos' && (
        <div className="tab-content">
          <form className="inline-form" onSubmit={handleAddIndispo}>
            <label className="inline-label">Du
              <input type="datetime-local" value={newIndispo.dateDebut} onChange={e => setNewIndispo({ ...newIndispo, dateDebut: e.target.value })} required />
            </label>
            <label className="inline-label">au
              <input type="datetime-local" value={newIndispo.dateFin} onChange={e => setNewIndispo({ ...newIndispo, dateFin: e.target.value })} required />
            </label>
            <input type="text" placeholder="Motif" value={newIndispo.motif} onChange={e => setNewIndispo({ ...newIndispo, motif: e.target.value })} />
            <button type="submit" className="btn btn-primary btn-small">Ajouter</button>
          </form>

          <ul className="items-list">
            {indisponibilites.map(i => (
              <li key={i.indispoId} className="item">
                <span className="item-date">
                  {formatDateTime(i.dateDebut)} → {formatDateTime(i.dateFin)}
                </span>
                <span className="item-desc">{i.motif || '—'}</span>
                <button className="btn btn-small btn-danger" onClick={() => handleDeleteIndispo(i.indispoId)}>Supprimer</button>
              </li>
            ))}
            {indisponibilites.length === 0 && <li className="empty">Aucune indisponibilité</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default DisponibilitesPage;
