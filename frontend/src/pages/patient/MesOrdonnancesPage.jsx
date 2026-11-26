/**
 * Page Mes ordonnances (Patient)
 * Liste paginée des ordonnances du patient (filtre ACTIVE / EXPIREE) et détail des lignes.
 * API : GET /ordonnances?statut=&page=&limit=  -  GET /ordonnances/{id}
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../services/auth';
import { API_URLS } from '../../services/api';
import { apiError, formatDate } from '../../utils/format';
import axios from 'axios';

const LIMIT = 10;

function MesOrdonnancesPage() {
  const { token } = useAuth();
  const [ordonnances, setOrdonnances] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statut, setStatut] = useState('');
  const [details, setDetails] = useState({});
  const [ouverte, setOuverte] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchOrdonnances = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (statut) params.statut = statut;
      const res = await axios.get(`${API_URLS.ordonnances}/ordonnances`, { headers, params });
      setOrdonnances(res.data.items || []);
      setTotal(res.data.count || 0);
      setError(null);
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement des ordonnances'));
    } finally {
      setLoading(false);
    }
  }, [page, statut, token]);

  useEffect(() => { fetchOrdonnances(); }, [fetchOrdonnances]);

  const toggle = async (o) => {
    if (ouverte === o.ordonnanceId) { setOuverte(null); return; }
    setOuverte(o.ordonnanceId);
    if (!details[o.ordonnanceId]) {
      try {
        const res = await axios.get(`${API_URLS.ordonnances}/ordonnances/${o.ordonnanceId}`, { headers });
        setDetails(d => ({ ...d, [o.ordonnanceId]: res.data.lignes || [] }));
      } catch (err) {
        setError(apiError(err));
      }
    }
  };

  const nbPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="page mes-ordonnances-page">
      <div className="page-header">
        <h1>Mes ordonnances</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-group filter-group">
        <label>Filtrer par statut</label>
        <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}>
          <option value="">Toutes</option>
          <option value="ACTIVE">Actives</option>
          <option value="EXPIREE">Expirées</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : ordonnances.length === 0 ? (
        <div className="no-data">Aucune ordonnance.</div>
      ) : (
        <div className="rendezvous-list">
          {ordonnances.map(o => (
            <div key={o.ordonnanceId} className={`card ordonnance-card status-${o.statut?.toLowerCase()}`}>
              <div className="card-body">
                <div className="ordonnance-card-header">
                  <div>
                    <strong>Ordonnance du {formatDate(o.dateEmission)}</strong>
                    <div>{o.praticienNom ? `Dr ${o.praticienNom}` : 'Praticien'}</div>
                    <small>Valable jusqu'au {formatDate(o.dateValidite)}</small>
                  </div>
                  <div className="ordonnance-card-actions">
                    <span className={`status-badge status-${o.statut?.toLowerCase()}`}>{o.statut === 'ACTIVE' ? 'Active' : 'Expirée'}</span>
                    <button className="btn btn-small btn-secondary" onClick={() => toggle(o)}>
                      {ouverte === o.ordonnanceId ? 'Masquer' : 'Voir le détail'}
                    </button>
                  </div>
                </div>

                {ouverte === o.ordonnanceId && (
                  <ul className="items-list">
                    {(details[o.ordonnanceId] || []).map(l => (
                      <li key={l.ligneId} className="item">
                        <span className="item-desc"><strong>{l.medicamentNom || l.medicamentId}</strong></span>
                        <span className="item-posologie">{l.posologie}</span>
                        <span className="item-duree">{l.duree} jours</span>
                        {l.instructions && <span className="item-instructions">{l.instructions}</span>}
                      </li>
                    ))}
                    {details[o.ordonnanceId]?.length === 0 && <li className="empty">Aucune ligne</li>}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {total > LIMIT && (
        <div className="pagination">
          <button className="btn btn-small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button>
          <span> Page {page} / {nbPages} </span>
          <button className="btn btn-small" disabled={page >= nbPages} onClick={() => setPage(page + 1)}>Suivant</button>
        </div>
      )}
    </div>
  );
}

export default MesOrdonnancesPage;
