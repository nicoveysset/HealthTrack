/**
 * Page Dossier Médical
 * - Patient  : /dossier-medical            → son propre dossier
 * - Praticien: /patients/:patientId/dossier → dossier d'un patient déjà consulté
 *   (sinon l'API renvoie 403 AccessDeniedException)
 * Consultation et modification : groupe sanguin, antécédents, allergies, vaccinations.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth, Role } from '../../services/auth';
import { API_URLS } from '../../services/api';
import { apiError, formatDate } from '../../utils/format';
import axios from 'axios';

const GROUPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const SEVERITES = { LEGERE: 'Légère', MODEREE: 'Modérée', SEVERE: 'Sévère' };
const EMPTY_ANTECEDENT = { libelle: '', type: 'PONCTUEL', date: '', description: '' };
const EMPTY_ALLERGIE = { medicamentConcerne: '', severite: 'LEGERE', dateDecouverte: '', description: '' };
const EMPTY_VACCIN = { nomVaccin: '', date: '', rappelPrevu: '', description: '' };

function DossierMedicalPage() {
  const params = useParams();
  const { user, token } = useAuth();
  const isPraticien = user?.type === Role.PRATICIEN;
  const patientId = params.patientId || user?.userId;

  const [patient, setPatient] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [antecedents, setAntecedents] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [ordonnances, setOrdonnances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('antecedents');

  const [newAntecedent, setNewAntecedent] = useState(EMPTY_ANTECEDENT);
  const [newAllergie, setNewAllergie] = useState(EMPTY_ALLERGIE);
  const [newVaccination, setNewVaccination] = useState(EMPTY_VACCIN);
  const [editAntecedent, setEditAntecedent] = useState(null);
  const [editAllergie, setEditAllergie] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };
  const base = `${API_URLS.dossiers}/patients/${patientId}`;

  const notify = (msg) => { setSuccess(msg); setError(null); setTimeout(() => setSuccess(null), 3000); };
  const fail = (err, fallback) => { setError(apiError(err, fallback)); setSuccess(null); };

  const fetchDossier = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${base}/dossier`, { headers });
      setDossier(res.data.dossier);
      setAntecedents(res.data.antecedents || []);
      setAllergies(res.data.allergies || []);
      setVaccinations(res.data.vaccinations || []);
      setAccessDenied(null);
      setError(null);
    } catch (err) {
      if (err.response?.status === 403) setAccessDenied(apiError(err));
      else fail(err, 'Erreur lors du chargement du dossier');
    } finally {
      setLoading(false);
    }
  }, [patientId, token]);

  useEffect(() => { fetchDossier(); }, [fetchDossier]);

  // Praticien : identité du patient et ordonnances déjà émises
  useEffect(() => {
    if (!isPraticien || !patientId) return;
    axios.get(`${API_URLS.utilisateurs}/utilisateurs/${patientId}`, { headers })
      .then(res => setPatient(res.data)).catch(() => {});
    axios.get(`${API_URLS.ordonnances}/ordonnances`, { headers, params: { patientId, limit: 20 } })
      .then(res => setOrdonnances(res.data.items || [])).catch(() => {});
  }, [isPraticien, patientId, token]);

  const run = async (fn, okMsg, fallback) => {
    try {
      await fn();
      await fetchDossier();
      notify(okMsg);
      return true;
    } catch (err) {
      fail(err, fallback);
      return false;
    }
  };

  // ---------- Groupe sanguin ----------
  const updateGroupe = (groupeSanguin) =>
    run(() => axios.patch(`${base}/dossier`, { groupeSanguin }, { headers }), 'Groupe sanguin enregistré');

  // ---------- Antécédents ----------
  const addAntecedent = async (e) => {
    e.preventDefault();
    const body = { ...newAntecedent, date: newAntecedent.date || undefined };
    if (await run(() => axios.post(`${base}/antecedents`, body, { headers }), 'Antécédent ajouté'))
      setNewAntecedent(EMPTY_ANTECEDENT);
  };
  const saveAntecedent = async (e) => {
    e.preventDefault();
    const { antecedentId, libelle, type, date, description } = editAntecedent;
    if (await run(() => axios.patch(`${API_URLS.dossiers}/antecedents/${antecedentId}`,
      { libelle, type, date, description }, { headers }), 'Antécédent modifié'))
      setEditAntecedent(null);
  };
  const setStatutAntecedent = (a, statut) =>
    run(() => axios.patch(`${API_URLS.dossiers}/antecedents/${a.antecedentId}`, { statut }, { headers }),
      statut === 'ARCHIVE' ? 'Antécédent archivé' : 'Antécédent réactivé');

  // ---------- Allergies ----------
  const addAllergie = async (e) => {
    e.preventDefault();
    const body = { ...newAllergie, dateDecouverte: newAllergie.dateDecouverte || undefined };
    if (await run(() => axios.post(`${base}/allergies`, body, { headers }), 'Allergie ajoutée'))
      setNewAllergie(EMPTY_ALLERGIE);
  };
  const saveAllergie = async (e) => {
    e.preventDefault();
    const { allergieId, medicamentConcerne, severite, dateDecouverte, description } = editAllergie;
    if (await run(() => axios.patch(`${API_URLS.dossiers}/allergies/${allergieId}`,
      { medicamentConcerne, severite, dateDecouverte, description }, { headers }), 'Allergie modifiée'))
      setEditAllergie(null);
  };
  const deleteAllergie = (a) => {
    if (!window.confirm(`Supprimer l'allergie « ${a.medicamentConcerne} » ?`)) return;
    run(() => axios.delete(`${API_URLS.dossiers}/allergies/${a.allergieId}`, { headers }), 'Allergie supprimée');
  };

  // ---------- Vaccinations ----------
  const addVaccination = async (e) => {
    e.preventDefault();
    const body = { ...newVaccination, rappelPrevu: newVaccination.rappelPrevu || undefined };
    if (await run(() => axios.post(`${base}/vaccinations`, body, { headers }), 'Vaccination ajoutée'))
      setNewVaccination(EMPTY_VACCIN);
  };

  if (loading && !dossier && !accessDenied) {
    return <div className="page"><div className="loading">Chargement du dossier médical...</div></div>;
  }

  const titre = isPraticien
    ? `Dossier médical${patient ? ` — ${patient.firstName} ${patient.lastName}` : ''}`
    : 'Mon dossier médical';

  if (accessDenied) {
    return (
      <div className="page dossier-medical-page">
        <div className="page-header"><h1>{titre}</h1></div>
        <div className="alert alert-warning">
          <strong>Accès refusé.</strong> {accessDenied}
          <p>Le dossier devient accessible dès que la consultation est en cours ou terminée.</p>
        </div>
        {isPraticien && <Link to="/agenda" className="btn btn-secondary">← Retour à l'agenda</Link>}
      </div>
    );
  }

  const visibles = antecedents.filter(a => showArchived || a.statut !== 'ARCHIVE');
  const nbArchives = antecedents.filter(a => a.statut === 'ARCHIVE').length;
  const today = new Date().toISOString().substring(0, 10);

  return (
    <div className="page dossier-medical-page">
      <div className="page-header">
        <div>
          <h1>{titre}</h1>
          {patient && (
            <p>Né(e) le {formatDate(patient.dateNaissance)} · N° SS {patient.nss}</p>
          )}
        </div>
        {isPraticien && <Link to="/agenda" className="btn btn-secondary">← Agenda</Link>}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {dossier && (
        <div className="dossier-info">
          <p>
            <strong>Groupe sanguin :</strong>{' '}
            <select value={dossier.groupeSanguin || ''} onChange={e => updateGroupe(e.target.value)} className="select-inline">
              {GROUPES.map(g => <option key={g} value={g}>{g || 'Non renseigné'}</option>)}
            </select>
          </p>
          <p><strong>Dossier créé le :</strong> {formatDate(dossier.dateCreation)}</p>
          <p><strong>Allergies connues :</strong>{' '}
            {allergies.length === 0 ? 'aucune' : allergies.map(a => (
              <span key={a.allergieId} className={`severite severite-${a.severite?.toLowerCase()}`}>{a.medicamentConcerne}</span>
            ))}
          </p>
        </div>
      )}

      <div className="tabs">
        {[
          ['antecedents', `Antécédents (${antecedents.length - nbArchives})`],
          ['allergies', `Allergies (${allergies.length})`],
          ['vaccinations', `Vaccinations (${vaccinations.length})`],
          ...(isPraticien ? [['ordonnances', `Ordonnances (${ordonnances.length})`]] : [])
        ].map(([tab, label]) => (
          <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {/* ===================== Antécédents ===================== */}
        {activeTab === 'antecedents' && (
          <div>
            <form className="inline-form" onSubmit={addAntecedent}>
              <input type="text" placeholder="Libellé (ex : Asthme)" value={newAntecedent.libelle}
                onChange={e => setNewAntecedent({ ...newAntecedent, libelle: e.target.value })} required />
              <select value={newAntecedent.type} onChange={e => setNewAntecedent({ ...newAntecedent, type: e.target.value })}>
                <option value="PONCTUEL">Ponctuel</option>
                <option value="CHRONIQUE">Chronique</option>
              </select>
              <input type="date" max={today} value={newAntecedent.date}
                onChange={e => setNewAntecedent({ ...newAntecedent, date: e.target.value })} title="Date" />
              <input type="text" placeholder="Description (facultatif)" value={newAntecedent.description}
                onChange={e => setNewAntecedent({ ...newAntecedent, description: e.target.value })} />
              <button type="submit" className="btn btn-primary btn-small">Ajouter</button>
            </form>

            {nbArchives > 0 && (
              <label className="checkbox-inline">
                <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
                Afficher les {nbArchives} antécédent(s) archivé(s)
              </label>
            )}

            <ul className="items-list">
              {visibles.map(a => (
                <li key={a.antecedentId} className={`item ${a.statut === 'ARCHIVE' ? 'archived' : ''}`}>
                  {editAntecedent?.antecedentId === a.antecedentId ? (
                    <form className="inline-form edit-form" onSubmit={saveAntecedent}>
                      <input type="text" value={editAntecedent.libelle} required
                        onChange={e => setEditAntecedent({ ...editAntecedent, libelle: e.target.value })} />
                      <select value={editAntecedent.type} onChange={e => setEditAntecedent({ ...editAntecedent, type: e.target.value })}>
                        <option value="PONCTUEL">Ponctuel</option>
                        <option value="CHRONIQUE">Chronique</option>
                      </select>
                      <input type="date" max={today} value={editAntecedent.date?.substring(0, 10) || ''}
                        onChange={e => setEditAntecedent({ ...editAntecedent, date: e.target.value })} />
                      <input type="text" placeholder="Description" value={editAntecedent.description || ''}
                        onChange={e => setEditAntecedent({ ...editAntecedent, description: e.target.value })} />
                      <button type="submit" className="btn btn-primary btn-small">Enregistrer</button>
                      <button type="button" className="btn btn-small" onClick={() => setEditAntecedent(null)}>Annuler</button>
                    </form>
                  ) : (
                    <>
                      <span className={`item-type type-${a.type?.toLowerCase()}`}>{a.type === 'CHRONIQUE' ? 'Chronique' : 'Ponctuel'}</span>
                      <span className="item-desc">
                        <strong>{a.libelle}</strong>
                        {a.description && <small> — {a.description}</small>}
                      </span>
                      <span className="item-date">{formatDate(a.date)}</span>
                      <span className="item-status">{a.statut === 'ARCHIVE' ? 'Archivé' : 'Actif'}</span>
                      <span className="item-actions">
                        {a.statut === 'ACTIF' && (
                          <button className="btn btn-small btn-secondary" onClick={() => setEditAntecedent({ ...a })}>Modifier</button>
                        )}
                        {a.statut === 'ACTIF' && (
                          <button className="btn btn-small btn-warning" onClick={() => setStatutAntecedent(a, 'ARCHIVE')}
                            title={a.type === 'CHRONIQUE' ? 'Un antécédent chronique ne peut pas être archivé' : ''}>
                            Archiver
                          </button>
                        )}
                        {a.statut === 'ARCHIVE' && (
                          <button className="btn btn-small btn-secondary" onClick={() => setStatutAntecedent(a, 'ACTIF')}>Réactiver</button>
                        )}
                      </span>
                    </>
                  )}
                </li>
              ))}
              {visibles.length === 0 && <li className="empty">Aucun antécédent</li>}
            </ul>
          </div>
        )}

        {/* ===================== Allergies ===================== */}
        {activeTab === 'allergies' && (
          <div>
            <form className="inline-form" onSubmit={addAllergie}>
              <input type="text" placeholder="Médicament concerné (ex : Amoxicilline)" value={newAllergie.medicamentConcerne}
                onChange={e => setNewAllergie({ ...newAllergie, medicamentConcerne: e.target.value })} required />
              <select value={newAllergie.severite} onChange={e => setNewAllergie({ ...newAllergie, severite: e.target.value })}>
                {Object.entries(SEVERITES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="date" max={today} value={newAllergie.dateDecouverte} title="Date de découverte"
                onChange={e => setNewAllergie({ ...newAllergie, dateDecouverte: e.target.value })} />
              <button type="submit" className="btn btn-primary btn-small">Ajouter</button>
            </form>

            <ul className="items-list">
              {allergies.map(a => (
                <li key={a.allergieId} className="item allergie">
                  {editAllergie?.allergieId === a.allergieId ? (
                    <form className="inline-form edit-form" onSubmit={saveAllergie}>
                      <input type="text" value={editAllergie.medicamentConcerne} required
                        onChange={e => setEditAllergie({ ...editAllergie, medicamentConcerne: e.target.value })} />
                      <select value={editAllergie.severite} onChange={e => setEditAllergie({ ...editAllergie, severite: e.target.value })}>
                        {Object.entries(SEVERITES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <input type="date" max={today} value={editAllergie.dateDecouverte?.substring(0, 10) || ''}
                        onChange={e => setEditAllergie({ ...editAllergie, dateDecouverte: e.target.value })} />
                      <button type="submit" className="btn btn-primary btn-small">Enregistrer</button>
                      <button type="button" className="btn btn-small" onClick={() => setEditAllergie(null)}>Annuler</button>
                    </form>
                  ) : (
                    <>
                      <span className="item-desc"><strong>{a.medicamentConcerne}</strong></span>
                      <span className={`severite severite-${a.severite?.toLowerCase()}`}>{SEVERITES[a.severite] || a.severite}</span>
                      <span className="item-date">découverte le {formatDate(a.dateDecouverte)}</span>
                      <span className="item-actions">
                        <button className="btn btn-small btn-secondary" onClick={() => setEditAllergie({ ...a })}>Modifier</button>
                        <button className="btn btn-small btn-danger" onClick={() => deleteAllergie(a)}>Supprimer</button>
                      </span>
                    </>
                  )}
                </li>
              ))}
              {allergies.length === 0 && <li className="empty">Aucune allergie connue</li>}
            </ul>
          </div>
        )}

        {/* ===================== Vaccinations ===================== */}
        {activeTab === 'vaccinations' && (
          <div>
            <form className="inline-form" onSubmit={addVaccination}>
              <input type="text" placeholder="Nom du vaccin (ex : DTP)" value={newVaccination.nomVaccin}
                onChange={e => setNewVaccination({ ...newVaccination, nomVaccin: e.target.value })} required />
              <label className="inline-label">Le
                <input type="date" max={today} value={newVaccination.date}
                  onChange={e => setNewVaccination({ ...newVaccination, date: e.target.value })} required />
              </label>
              <label className="inline-label">Rappel
                <input type="date" value={newVaccination.rappelPrevu}
                  onChange={e => setNewVaccination({ ...newVaccination, rappelPrevu: e.target.value })} />
              </label>
              <button type="submit" className="btn btn-primary btn-small">Ajouter</button>
            </form>

            <ul className="items-list">
              {vaccinations.map(v => (
                <li key={v.vaccinationId} className="item">
                  <span className="item-desc"><strong>{v.nomVaccin}</strong></span>
                  <span className="item-date">le {formatDate(v.date)}</span>
                  <span className="item-lot">{v.rappelPrevu ? `Rappel prévu le ${formatDate(v.rappelPrevu)}` : 'Pas de rappel'}</span>
                </li>
              ))}
              {vaccinations.length === 0 && <li className="empty">Aucune vaccination</li>}
            </ul>
          </div>
        )}

        {/* ===================== Ordonnances (praticien) ===================== */}
        {activeTab === 'ordonnances' && (
          <ul className="items-list">
            {ordonnances.map(o => (
              <li key={o.ordonnanceId} className="item">
                <span className="item-desc"><strong>Ordonnance du {formatDate(o.dateEmission)}</strong>
                  {o.praticienNom && <small> — Dr {o.praticienNom}</small>}</span>
                <span className={`status-badge status-${o.statut?.toLowerCase()}`}>{o.statut}</span>
                <span className="item-date">valable jusqu'au {formatDate(o.dateValidite)}</span>
                {o.rdvId && <Link className="btn btn-small btn-secondary" to={`/rendezvous/${o.rdvId}/ordonnance`}>Ouvrir</Link>}
              </li>
            ))}
            {ordonnances.length === 0 && <li className="empty">Aucune ordonnance</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

export default DossierMedicalPage;
