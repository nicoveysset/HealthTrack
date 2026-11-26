/**
 * Page Ordonnance (Praticien)
 * Création de l'ordonnance d'un RDV TERMINE (compte rendu finalisé),
 * ajout / retrait de lignes de prescription, rappel des allergies du patient.
 * Route : /rendezvous/:rdvId/ordonnance
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../services/auth';
import { API_URLS } from '../../services/api';
import { apiError, formatDate, formatLongDate } from '../../utils/format';
import axios from 'axios';

const EMPTY_LIGNE = { medicamentId: '', posologie: '', duree: '', instructions: '' };

function OrdonnancePage() {
  const { rdvId } = useParams();
  const { token } = useAuth();
  const [rdv, setRdv] = useState(null);
  const [ordonnance, setOrdonnance] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [medicaments, setMedicaments] = useState([]);
  const [searchMed, setSearchMed] = useState('');
  const [newLigne, setNewLigne] = useState(EMPTY_LIGNE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const loadOrdonnance = useCallback(async (id) => {
    const res = await axios.get(`${API_URLS.ordonnances}/ordonnances/${id}`, { headers });
    setOrdonnance(res.data.ordonnance);
    setLignes(res.data.lignes || []);
  }, [token]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const rdvRes = await axios.get(`${API_URLS.rdv}/rendezvous/${rdvId}`, { headers });
      setRdv(rdvRes.data);
      const ordRes = await axios.get(`${API_URLS.ordonnances}/ordonnances`, { headers, params: { rdvId, limit: 1 } });
      const existante = (ordRes.data.items || [])[0];
      if (existante) await loadOrdonnance(existante.ordonnanceId);
      axios.get(`${API_URLS.dossiers}/patients/${rdvRes.data.patientId}/allergies`, { headers })
        .then(res => setAllergies(res.data || [])).catch(() => setAllergies([]));
      setError(null);
    } catch (err) {
      setError(apiError(err, 'Erreur de chargement'));
    } finally {
      setLoading(false);
    }
  }, [rdvId, token, loadOrdonnance]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const t = setTimeout(() => {
      axios.get(`${API_URLS.ordonnances}/medicaments`, { headers, params: { search: searchMed || undefined, limit: 50 } })
        .then(res => setMedicaments(res.data.items || []))
        .catch(() => setMedicaments([]));
    }, 250);
    return () => clearTimeout(t);
  }, [token, searchMed]);

  const notify = (msg) => { setSuccess(msg); setError(null); setTimeout(() => setSuccess(null), 4000); };
  const fail = (err, fallback) => { setError(apiError(err, fallback)); setSuccess(null); };

  const creer = async () => {
    try {
      const res = await axios.post(`${API_URLS.ordonnances}/ordonnances`, { rdvId }, { headers });
      setOrdonnance(res.data);
      setLignes([]);
      notify('Ordonnance créée (valable 3 mois).');
    } catch (err) {
      fail(err, 'Erreur lors de la création');
    }
  };

  const ajouterLigne = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URLS.ordonnances}/ordonnances/${ordonnance.ordonnanceId}/lignes`,
        { ...newLigne, duree: Number(newLigne.duree) }, { headers });
      notify(Number(newLigne.duree) > 90
        ? 'Ligne ajoutée — durée supérieure à 90 jours : une alerte métier a été envoyée à CloudWatch.'
        : 'Ligne ajoutée.');
      setNewLigne(EMPTY_LIGNE);
      loadOrdonnance(ordonnance.ordonnanceId);
    } catch (err) {
      fail(err, 'Erreur lors de l\'ajout de la ligne');
    }
  };

  const retirerLigne = async (l) => {
    if (!window.confirm(`Retirer ${l.medicamentNom || 'cette ligne'} de l'ordonnance ?`)) return;
    try {
      await axios.delete(`${API_URLS.ordonnances}/ordonnances/${ordonnance.ordonnanceId}/lignes/${l.ligneId}`, { headers });
      notify('Ligne retirée.');
      loadOrdonnance(ordonnance.ordonnanceId);
    } catch (err) {
      fail(err);
    }
  };

  if (loading) return <div className="page"><div className="loading">Chargement...</div></div>;

  const nomMedicament = (id) => medicaments.find(m => m.medicamentId === id)?.nom || id;
  const expiree = ordonnance?.statut === 'EXPIREE';

  return (
    <div className="page ordonnance-page">
      <div className="page-header">
        <h1>Ordonnance</h1>
        <Link className="btn btn-secondary" to={`/rendezvous/${rdvId}/compte-rendu`}>← Compte rendu</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {rdv && (
        <div className="rdv-summary">
          <p><strong>Patient :</strong> {rdv.patientNom || rdv.patientId}</p>
          <p><strong>Consultation :</strong> {formatLongDate(rdv.date)} à {rdv.heure}</p>
          <p><strong>Allergies connues :</strong>{' '}
            {allergies.length === 0 ? 'aucune' : allergies.map(a => (
              <span key={a.allergieId} className={`severite severite-${a.severite?.toLowerCase()}`}>{a.medicamentConcerne}</span>
            ))}
          </p>
        </div>
      )}

      {!ordonnance ? (
        <div className="ordonnance-form">
          <p>Aucune ordonnance pour cette consultation.</p>
          <p><small>La consultation doit être terminée et son compte rendu finalisé.</small></p>
          <button className="btn btn-primary" onClick={creer}>Créer l'ordonnance</button>
        </div>
      ) : (
        <div className="ordonnance-detail">
          <div className="ordonnance-header">
            <p>
              <strong>Émise le :</strong> {formatDate(ordonnance.dateEmission)} ·{' '}
              <strong>Valable jusqu'au :</strong> {formatDate(ordonnance.dateValidite)} ·{' '}
              <span className={`status-badge status-${ordonnance.statut?.toLowerCase()}`}>{ordonnance.statut}</span>
            </p>
          </div>

          <h3>Prescription ({lignes.length} ligne{lignes.length > 1 ? 's' : ''})</h3>
          <ul className="items-list">
            {lignes.map(l => (
              <li key={l.ligneId} className="item">
                <span className="item-desc"><strong>{l.medicamentNom || nomMedicament(l.medicamentId)}</strong></span>
                <span className="item-posologie">{l.posologie}</span>
                <span className={`item-duree ${l.duree > 90 ? 'duree-longue' : ''}`}>{l.duree} jours</span>
                {l.instructions && <span className="item-instructions">{l.instructions}</span>}
                {!expiree && (
                  <button className="btn btn-small btn-danger" onClick={() => retirerLigne(l)}>Retirer</button>
                )}
              </li>
            ))}
            {lignes.length === 0 && <li className="empty">Aucune ligne de prescription</li>}
          </ul>

          {expiree ? (
            <div className="alert alert-warning">Cette ordonnance est expirée : elle ne peut plus être modifiée.</div>
          ) : (
            <>
              <h3>Ajouter un médicament</h3>
              <form onSubmit={ajouterLigne} className="inline-form ligne-form">
                <input type="text" placeholder="Rechercher..." value={searchMed} onChange={(e) => setSearchMed(e.target.value)} />
                <select value={newLigne.medicamentId} onChange={(e) => setNewLigne({ ...newLigne, medicamentId: e.target.value })} required>
                  <option value="">— Médicament —</option>
                  {medicaments.map(m => (
                    <option key={m.medicamentId} value={m.medicamentId}>
                      {m.nom}{m.substanceActive ? ` (${m.substanceActive})` : ''} — {m.forme}
                    </option>
                  ))}
                </select>
                <input type="text" placeholder="Posologie (ex : 1 cp matin et soir)" value={newLigne.posologie}
                  onChange={(e) => setNewLigne({ ...newLigne, posologie: e.target.value })} required />
                <input type="number" placeholder="Durée (jours)" min="1" value={newLigne.duree}
                  onChange={(e) => setNewLigne({ ...newLigne, duree: e.target.value })} required />
                <input type="text" placeholder="Instructions (facultatif)" value={newLigne.instructions}
                  onChange={(e) => setNewLigne({ ...newLigne, instructions: e.target.value })} />
                <button type="submit" className="btn btn-primary btn-small">Ajouter</button>
              </form>
              {Number(newLigne.duree) > 90 && (
                <div className="alert alert-warning">Durée supérieure à 90 jours : la ligne sera acceptée mais une alerte métier sera levée.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default OrdonnancePage;
