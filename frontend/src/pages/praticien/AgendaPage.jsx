/**
 * Page Agenda du praticien
 * Rendez-vous du jour ou de la semaine, avec les actions du cycle de vie :
 * PLANIFIE → CONFIRME → EN_COURS → TERMINE (ou ANNULE / NON_VENU),
 * puis compte rendu, ordonnance et accès au dossier du patient.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../services/auth';
import { API_URLS } from '../../services/api';
import { toISODate, addDays, formatLongDate, heureFin, apiError, STATUTS_RDV, STATUT_RDV_CLASS } from '../../utils/format';
import axios from 'axios';

/** Lundi de la semaine contenant d */
const mondayOf = (d) => {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  return copy;
};

function PraticienAgendaPage() {
  const { token } = useAuth();
  const [rendezvous, setRendezvous] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [date, setDate] = useState(() => new Date());
  const [vue, setVue] = useState('jour');
  const [showAnnules, setShowAnnules] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };
  const debut = vue === 'jour' ? date : mondayOf(date);
  const fin = vue === 'jour' ? date : addDays(mondayOf(date), 6);

  const fetchRendezvous = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URLS.rdv}/rendezvous`, {
        headers,
        params: { dateDebut: toISODate(debut), dateFin: toISODate(fin), page: 1, limit: 100 }
      });
      setRendezvous(res.data.items || []);
      setError(null);
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement de l\'agenda'));
    } finally {
      setLoading(false);
    }
  }, [token, toISODate(debut), toISODate(fin)]);

  useEffect(() => { fetchRendezvous(); }, [fetchRendezvous]);

  const changerStatut = async (rdv, statut, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    try {
      await axios.patch(`${API_URLS.rdv}/rendezvous/${rdv.rdvId}`, { statut }, { headers });
      setSuccess(`Rendez-vous de ${rdv.heure} : ${STATUTS_RDV[statut].toLowerCase()}`);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
      fetchRendezvous();
    } catch (err) {
      setError(apiError(err));
      setSuccess(null);
    }
  };

  const deplacer = (sens) => setDate(addDays(date, sens * (vue === 'jour' ? 1 : 7)));

  const visibles = rendezvous.filter(r => showAnnules || r.statut !== 'ANNULE');
  const parJour = visibles.reduce((acc, r) => {
    (acc[r.date] = acc[r.date] || []).push(r);
    return acc;
  }, {});
  const jours = Object.keys(parJour).sort();

  const stats = {
    total: visibles.length,
    aVenir: visibles.filter(r => r.statut === 'PLANIFIE' || r.statut === 'CONFIRME').length,
    termines: visibles.filter(r => r.statut === 'TERMINE').length
  };

  const libellePeriode = vue === 'jour'
    ? formatLongDate(toISODate(date))
    : `Semaine du ${debut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  return (
    <div className="page agenda-page">
      <div className="page-header">
        <h1>Mon agenda</h1>
        <div className="tabs tabs-compact">
          <button className={`tab ${vue === 'jour' ? 'active' : ''}`} onClick={() => setVue('jour')}>Jour</button>
          <button className={`tab ${vue === 'semaine' ? 'active' : ''}`} onClick={() => setVue('semaine')}>Semaine</button>
        </div>
      </div>

      <div className="date-navigator">
        <button className="btn btn-icon" onClick={() => deplacer(-1)} aria-label="Précédent">‹</button>
        <span className="current-date">{libellePeriode}</span>
        <button className="btn btn-icon" onClick={() => deplacer(1)} aria-label="Suivant">›</button>
        <button className="btn btn-small btn-secondary" onClick={() => setDate(new Date())}>Aujourd'hui</button>
      </div>

      <div className="agenda-stats">
        <span><strong>{stats.total}</strong> rendez-vous</span>
        <span><strong>{stats.aVenir}</strong> à venir</span>
        <span><strong>{stats.termines}</strong> terminé(s)</span>
        <label className="checkbox-inline">
          <input type="checkbox" checked={showAnnules} onChange={e => setShowAnnules(e.target.checked)} />
          Afficher les annulés
        </label>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div className="loading">Chargement des rendez-vous...</div>
      ) : jours.length === 0 ? (
        <div className="no-rendezvous"><p>Aucun rendez-vous sur cette période.</p></div>
      ) : (
        <div className="agenda-content">
          {jours.map(jour => (
            <div key={jour} className="agenda-day">
              {vue === 'semaine' && <h3>{formatLongDate(jour)}</h3>}
              <div className="rendezvous-list">
                {parJour[jour].map(rdv => (
                  <div key={rdv.rdvId} className={`rendezvous-card ${STATUT_RDV_CLASS[rdv.statut] || ''}`}>
                    <div className="rdv-time">{rdv.heure} – {heureFin(rdv.heure, rdv.duree)}</div>

                    <div className="rdv-info">
                      <div className="rdv-patient">{rdv.patientNom || `Patient ${rdv.patientId.substring(0, 8)}`}</div>
                      {rdv.motif && <div className="rdv-duration">{rdv.motif}</div>}
                      <div className="rdv-status">{STATUTS_RDV[rdv.statut] || rdv.statut}</div>
                    </div>

                    <div className="rdv-actions">
                      {rdv.statut === 'PLANIFIE' && (
                        <button className="btn btn-small btn-success" onClick={() => changerStatut(rdv, 'CONFIRME')}>Confirmer</button>
                      )}
                      {rdv.statut === 'CONFIRME' && (
                        <button className="btn btn-small btn-primary" onClick={() => changerStatut(rdv, 'EN_COURS')}>Commencer</button>
                      )}
                      {rdv.statut === 'EN_COURS' && (
                        <button className="btn btn-small btn-success" onClick={() => changerStatut(rdv, 'TERMINE')}>Terminer</button>
                      )}
                      {rdv.statut === 'TERMINE' && (
                        <>
                          <Link className="btn btn-small btn-primary" to={`/rendezvous/${rdv.rdvId}/compte-rendu`}>Compte rendu</Link>
                          <Link className="btn btn-small btn-secondary" to={`/rendezvous/${rdv.rdvId}/ordonnance`}>Ordonnance</Link>
                        </>
                      )}
                      {(rdv.statut === 'EN_COURS' || rdv.statut === 'TERMINE') && (
                        <Link className="btn btn-small btn-secondary" to={`/patients/${rdv.patientId}/dossier`}>Dossier</Link>
                      )}
                      {(rdv.statut === 'PLANIFIE' || rdv.statut === 'CONFIRME') && (
                        <>
                          <button className="btn btn-small btn-warning"
                            onClick={() => changerStatut(rdv, 'NON_VENU', 'Déclarer le patient absent ?')}>Absent</button>
                          <button className="btn btn-small btn-danger"
                            onClick={() => changerStatut(rdv, 'ANNULE', `Annuler le rendez-vous de ${rdv.heure} ?`)}>Annuler</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PraticienAgendaPage;
