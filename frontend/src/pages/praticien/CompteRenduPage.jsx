/**
 * Page Compte Rendu (Praticien)
 * Rédaction (brouillon) puis finalisation du compte rendu d'un RDV TERMINE.
 * Une fois finalisé, le compte rendu n'est plus modifiable et l'ordonnance peut être émise.
 * Route : /rendezvous/:rdvId/compte-rendu
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../services/auth';
import { API_URLS } from '../../services/api';
import { apiError, formatLongDate, formatDateTime, STATUTS_RDV } from '../../utils/format';
import axios from 'axios';

function CompteRenduPage() {
  const { rdvId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [rdv, setRdv] = useState(null);
  const [cr, setCr] = useState(null);
  const [contenu, setContenu] = useState('');
  const [diagnostic, setDiagnostic] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };
  const url = `${API_URLS.rdv}/rendezvous/${rdvId}/compte-rendu`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const rdvRes = await axios.get(`${API_URLS.rdv}/rendezvous/${rdvId}`, { headers });
      setRdv(rdvRes.data);
      try {
        const crRes = await axios.get(url, { headers });
        setCr(crRes.data);
        setContenu(crRes.data.contenu || '');
        setDiagnostic(crRes.data.diagnostic || '');
      } catch (crErr) {
        if (crErr.response?.status !== 404) throw crErr;
        setCr(null);
      }
      setError(null);
    } catch (err) {
      setError(apiError(err, 'Erreur de chargement'));
    } finally {
      setLoading(false);
    }
  }, [rdvId, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const finalise = cr && (cr.statut === 'FINALISE' || (!cr.statut && cr.dateFinalisation));

  const save = async (finaliser) => {
    if (finaliser && !window.confirm('Finaliser le compte rendu ? Il ne sera plus modifiable.')) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = { contenu, diagnostic, finaliser };
      const res = cr
        ? await axios.put(url, body, { headers })
        : await axios.post(url, body, { headers });
      setCr(res.data);
      setSuccess(finaliser ? 'Compte rendu finalisé. Vous pouvez maintenant rédiger l\'ordonnance.' : 'Brouillon enregistré.');
    } catch (err) {
      setError(apiError(err, 'Erreur lors de l\'enregistrement'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page"><div className="loading">Chargement...</div></div>;

  const termine = rdv?.statut === 'TERMINE';

  return (
    <div className="page compte-rendu-page">
      <div className="page-header">
        <h1>Compte rendu de consultation</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/agenda')}>← Agenda</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {rdv && (
        <div className="rdv-summary">
          <p><strong>Patient :</strong> {rdv.patientNom || rdv.patientId}</p>
          <p><strong>Consultation :</strong> {formatLongDate(rdv.date)} à {rdv.heure}{rdv.motif ? ` — ${rdv.motif}` : ''}</p>
          <p><strong>Statut :</strong> {STATUTS_RDV[rdv.statut] || rdv.statut}
            {cr && <> · <strong>Compte rendu :</strong> {finalise ? `finalisé le ${formatDateTime(cr.dateFinalisation)}` : 'brouillon'}</>}
          </p>
          <p>
            <Link to={`/patients/${rdv.patientId}/dossier`}>Voir le dossier médical du patient →</Link>
          </p>
        </div>
      )}

      {!termine && !cr && (
        <div className="alert alert-warning">
          Le compte rendu ne peut être rédigé qu'une fois la consultation terminée (statut TERMINE).
        </div>
      )}

      {finalise ? (
        <div className="existing-cr">
          <h3>Compte rendu finalisé</h3>
          {cr.diagnostic && <p><strong>Diagnostic :</strong> {cr.diagnostic}</p>}
          <p className="cr-contenu">{cr.contenu}</p>
          <Link className="btn btn-primary" to={`/rendezvous/${rdvId}/ordonnance`}>Rédiger / voir l'ordonnance</Link>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); save(false); }}>
          <div className="form-group">
            <label>Contenu du compte rendu * <small>(10 caractères minimum)</small></label>
            <textarea rows={8} value={contenu} onChange={(e) => setContenu(e.target.value)} required minLength={10}
              placeholder="Motif, examen clinique, conclusions..." disabled={!termine} />
          </div>
          <div className="form-group">
            <label>Diagnostic</label>
            <input type="text" value={diagnostic} onChange={(e) => setDiagnostic(e.target.value)}
              placeholder="Diagnostic posé" disabled={!termine} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-secondary" disabled={saving || !termine}>
              {saving ? 'Enregistrement...' : 'Enregistrer le brouillon'}
            </button>
            <button type="button" className="btn btn-primary" disabled={saving || !termine || contenu.trim().length < 10}
              onClick={() => save(true)}>
              Finaliser le compte rendu
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default CompteRenduPage;
