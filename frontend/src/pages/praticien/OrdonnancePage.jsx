/**
 * Page Ordonnance (Praticien)
 * Création et consultation d'une ordonnance
 * Route : /ordonnances/new
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../services/auth';
import { API_URLS } from '../../services/api';
import axios from 'axios';

function OrdonnancePage() {
  const { token } = useAuth();
  const [compteRenduId, setCompteRenduId] = useState('');
  const [ordonnance, setOrdonnance] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [medicaments, setMedicaments] = useState([]);
  const [searchMed, setSearchMed] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Nouvelle ligne
  const [newLigne, setNewLigne] = useState({ medicamentId: '', posologie: '', duree: '', instructions: '' });

  const headers = { Authorization: `Bearer ${token}` };

  // Charger les médicaments
  useEffect(() => {
    const fetchMedicaments = async () => {
      try {
        const res = await axios.get(`${API_URLS.ordonnances}/medicaments`, {
          headers,
          params: { search: searchMed, limit: 50 }
        });
        setMedicaments(res.data.items || []);
      } catch (err) {
        console.error('Erreur chargement médicaments:', err);
      }
    };
    fetchMedicaments();
  }, [token, searchMed]);

  // Créer une ordonnance
  const handleCreateOrdonnance = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await axios.post(
        `${API_URLS.ordonnances}/ordonnances`,
        { compteRenduId },
        { headers }
      );
      setOrdonnance(res.data);
      setSuccess('Ordonnance créée avec succès !');
      // Charger les lignes
      fetchLignes(res.data.ordonnanceId);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  // Charger les lignes d'une ordonnance
  const fetchLignes = useCallback(async (ordonnanceId) => {
    try {
      const res = await axios.get(
        `${API_URLS.ordonnances}/ordonnances/${ordonnanceId}/lignes`,
        { headers }
      );
      setLignes(Array.isArray(res.data) ? res.data : (res.data.items || []));
    } catch (err) {
      console.error('Erreur chargement lignes:', err);
    }
  }, [token]);

  // Ajouter une ligne
  const handleAddLigne = async (e) => {
    e.preventDefault();
    if (!ordonnance) return;
    setError(null);

    try {
      await axios.post(
        `${API_URLS.ordonnances}/ordonnances/${ordonnance.ordonnanceId}/lignes`,
        newLigne,
        { headers }
      );
      setNewLigne({ medicamentId: '', posologie: '', duree: '', instructions: '' });
      setSuccess('Ligne ajoutée !');
      fetchLignes(ordonnance.ordonnanceId);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'ajout de la ligne');
    }
  };

  // Supprimer une ligne
  const handleDeleteLigne = async (ligneId) => {
    if (!ordonnance || !window.confirm('Supprimer cette ligne ?')) return;
    try {
      await axios.delete(
        `${API_URLS.ordonnances}/ordonnances/${ordonnance.ordonnanceId}/lignes/${ligneId}`,
        { headers }
      );
      fetchLignes(ordonnance.ordonnanceId);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    }
  };

  return (
    <div className="page ordonnance-page">
      <div className="page-header">
        <h1>Nouvelle ordonnance</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {!ordonnance ? (
        <form onSubmit={handleCreateOrdonnance} className="ordonnance-form">
          <div className="form-group">
            <label>ID du compte rendu *</label>
            <input
              type="text"
              value={compteRenduId}
              onChange={(e) => setCompteRenduId(e.target.value)}
              placeholder="ID du compte rendu finalisé"
              required
            />
            <small>Le compte rendu doit être finalisé (RDV terminé) pour créer une ordonnance.</small>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Création...' : 'Créer l\'ordonnance'}
          </button>
        </form>
      ) : (
        <div className="ordonnance-detail">
          <div className="ordonnance-header">
            <h2>Ordonnance #{ordonnance.ordonnanceId}</h2>
            <p><strong>Statut :</strong> <span className={`status-${ordonnance.statut?.toLowerCase()}`}>{ordonnance.statut}</span></p>
            {ordonnance.dateExpiration && (
              <p><strong>Valable jusqu'au :</strong> {new Date(ordonnance.dateExpiration).toLocaleDateString('fr-FR')}</p>
            )}
          </div>

          <h3>Lignes de prescription ({lignes.length})</h3>

          <ul className="items-list">
            {lignes.map(l => (
              <li key={l.ligneId} className="item">
                <span className="item-desc">{l.medicamentId}</span>
                <span className="item-posologie">{l.posologie}</span>
                <span className="item-duree">{l.duree} jours</span>
                {l.instructions && <span className="item-instructions">{l.instructions}</span>}
                <button className="btn btn-small btn-danger" onClick={() => handleDeleteLigne(l.ligneId)}>✕</button>
              </li>
            ))}
            {lignes.length === 0 && <li className="empty">Aucune ligne de prescription</li>}
          </ul>

          <h3>Ajouter une ligne</h3>
          <form onSubmit={handleAddLigne} className="inline-form ligne-form">
            <div className="form-group">
              <label>Médicament</label>
              <input
                type="text"
                placeholder="Rechercher un médicament..."
                value={searchMed}
                onChange={(e) => setSearchMed(e.target.value)}
              />
              <select
                value={newLigne.medicamentId}
                onChange={(e) => setNewLigne({ ...newLigne, medicamentId: e.target.value })}
                required
              >
                <option value="">— Choisir —</option>
                {medicaments.map(m => (
                  <option key={m.medicamentId} value={m.medicamentId}>
                    {m.nom} {m.dosage ? `(${m.dosage})` : ''} {m.forme ? `- ${m.forme}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              placeholder="Posologie (ex: 3 fois/jour)"
              value={newLigne.posologie}
              onChange={(e) => setNewLigne({ ...newLigne, posologie: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Durée (jours)"
              value={newLigne.duree}
              onChange={(e) => setNewLigne({ ...newLigne, duree: e.target.value })}
              required
              min="1"
              max="90"
            />
            <input
              type="text"
              placeholder="Instructions particulières"
              value={newLigne.instructions}
              onChange={(e) => setNewLigne({ ...newLigne, instructions: e.target.value })}
            />
            <button type="submit" className="btn btn-primary btn-small">Ajouter la ligne</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default OrdonnancePage;
