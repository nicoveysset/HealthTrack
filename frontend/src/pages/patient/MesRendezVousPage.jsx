/**
 * Page Mes rendez-vous (Patient)
 * Liste les rendez-vous du patient connecte (pagines, filtrables par statut)
 * et permet d'annuler un rendez-vous a venir.
 * API : GET /rendezvous?statut=&page=&limit=  -  PATCH /rendezvous/{id} { statut: "ANNULE" }
 *       GET /rendezvous/{id}/compte-rendu (consultation terminée)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../services/auth';
import { API_URLS } from '../../services/api';
import axios from 'axios';

const LIMIT = 10;

const STATUTS = {
  PLANIFIE: 'Planifié',
  CONFIRME: 'Confirmé',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
  NON_VENU: 'Non venu'
};

// Classes CSS existantes (styles/index.css) pour la bordure de couleur par statut
const STATUT_CLASS = {
  PLANIFIE: 'status-planifié',
  CONFIRME: 'status-confirmé',
  EN_COURS: 'status-en-cours',
  TERMINE: 'status-terminé',
  ANNULE: 'status-annulé',
  NON_VENU: 'status-non-venu'
};

function MesRendezVousPage() {
  const { token } = useAuth();
  const [rendezvous, setRendezvous] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statut, setStatut] = useState('');
  const [praticiens, setPraticiens] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  // Noms des praticiens (le RDV ne contient que praticienId)
  useEffect(() => {
    axios.get(`${API_URLS.utilisateurs}/praticiens`, { headers, params: { limit: 100 } })
      .then(res => {
        const map = {};
        (res.data.items || []).forEach(p => {
          map[p.userId] = `Dr ${p.firstName || ''} ${p.lastName || ''}`.trim() +
            (p.specialite ? ` (${p.specialite})` : '');
        });
        setPraticiens(map);
      })
      .catch(() => { /* les noms sont un confort d'affichage : on ignore l'erreur */ });
  }, [token]);

  const fetchRendezvous = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: LIMIT };
      if (statut) params.statut = statut;
      const res = await axios.get(`${API_URLS.rdv}/rendezvous`, { headers, params });
      setRendezvous(res.data.items || []);
      setTotal(res.data.count || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des rendez-vous');
    } finally {
      setLoading(false);
    }
  }, [page, statut, token]);

  useEffect(() => {
    fetchRendezvous();
  }, [fetchRendezvous]);

  const annuler = async (rdv) => {
    if (!window.confirm(`Annuler le rendez-vous du ${formatDate(rdv.date)} à ${rdv.heure} ?`)) return;
    setError(null);
    setSuccess(null);
    try {
      await axios.patch(`${API_URLS.rdv}/rendezvous/${rdv.rdvId}`, { statut: 'ANNULE' }, { headers });
      setSuccess('Rendez-vous annulé.');
      fetchRendezvous();
    } catch (err) {
      // ex. CancellationTooLateException (moins de 2h avant)
      setError(err.response?.data?.message || "Erreur lors de l'annulation");
    }
  };

  const [compteRendus, setCompteRendus] = useState({});
  const voirCompteRendu = async (rdv) => {
    if (compteRendus[rdv.rdvId]) {
      setCompteRendus(({ [rdv.rdvId]: _, ...rest }) => rest);
      return;
    }
    try {
      const res = await axios.get(`${API_URLS.rdv}/rendezvous/${rdv.rdvId}/compte-rendu`, { headers });
      setCompteRendus(c => ({ ...c, [rdv.rdvId]: res.data }));
    } catch (err) {
      setError(err.response?.status === 404
        ? "Le compte rendu de cette consultation n'est pas encore disponible."
        : (err.response?.data?.message || 'Erreur'));
    }
  };

  const formatDate = (d) =>
    new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

  const nbPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="page mes-rdv-page">
      <div className="page-header">
        <h1>Mes rendez-vous</h1>
        <Link to="/prise-rdv" className="btn btn-primary">Prendre un RDV</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="form-group">
        <label>Filtrer par statut</label>
        <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}>
          <option value="">Tous</option>
          <option value="PLANIFIE,CONFIRME">À venir (planifiés et confirmés)</option>
          {Object.entries(STATUTS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : rendezvous.length === 0 ? (
        <div className="no-data">Aucun rendez-vous.</div>
      ) : (
        <div className="rendezvous-list">
          {rendezvous.map(rdv => (
            <div key={rdv.rdvId} className={`card rendezvous-card ${STATUT_CLASS[rdv.statut] || ''}`}>
              <div className="card-body">
                <strong>{formatDate(rdv.date)} à {rdv.heure}</strong>
                <div>{praticiens[rdv.praticienId] || (rdv.praticienNom ? `Dr ${rdv.praticienNom}` : 'Praticien')}</div>
                {rdv.motif && <div>Motif : {rdv.motif}</div>}
                <div>Durée : {rdv.duree || 30} min — Statut : <strong>{STATUTS[rdv.statut] || rdv.statut}</strong></div>
                {(rdv.statut === 'PLANIFIE' || rdv.statut === 'CONFIRME') && (
                  <button className="btn btn-small btn-danger" onClick={() => annuler(rdv)}>
                    Annuler
                  </button>
                )}
                {rdv.statut === 'TERMINE' && (
                  <button className="btn btn-small btn-secondary" onClick={() => voirCompteRendu(rdv)}>
                    {compteRendus[rdv.rdvId] ? 'Masquer le compte rendu' : 'Voir le compte rendu'}
                  </button>
                )}
                {compteRendus[rdv.rdvId] && (
                  <div className="existing-cr">
                    {compteRendus[rdv.rdvId].diagnostic && <p><strong>Diagnostic :</strong> {compteRendus[rdv.rdvId].diagnostic}</p>}
                    <p className="cr-contenu">{compteRendus[rdv.rdvId].contenu}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {total > LIMIT && (
        <div className="pagination">
          <button className="btn btn-small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Précédent
          </button>
          <span> Page {page} / {nbPages} </span>
          <button className="btn btn-small" disabled={page >= nbPages} onClick={() => setPage(page + 1)}>
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

export default MesRendezVousPage;
