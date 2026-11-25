/**
 * Page Compte Rendu (Praticien)
 * Rédaction et finalisation du compte rendu après un RDV terminé
 * Route : /rendezvous/:rdvId/compte-rendu
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth';
import { API_URLS } from '../../services/api';
import axios from 'axios';

function CompteRenduPage() {
  const { rdvId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [rdv, setRdv] = useState(null);
  const [contenu, setContenu] = useState('');
  const [diagnostic, setDiagnostic] = useState('');
  const [existingCR, setExistingCR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Récupérer le RDV
      const rdvRes = await axios.get(`${API_URLS.rdv}/rendezvous`, {
        headers,
        params: { page: 1, limit: 100 }
      });
      const rdvs = rdvRes.data.items || [];
      const found = rdvs.find(r => r.rdvId === rdvId);
      setRdv(found || null);

      // Vérifier si un compte rendu existe déjà
      try {
        const crRes = await axios.get(`${API_URLS.rdv}/rendezvous/${rdvId}/compte-rendu`, { headers });
        setExistingCR(crRes.data);
        setContenu(crRes.data.contenu || '');
        setDiagnostic(crRes.data.diagnostic || '');
      } catch (crErr) {
        if (crErr.response?.status !== 404) {
          throw crErr;
        }
        setExistingCR(null);
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [rdvId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await axios.post(
        `${API_URLS.rdv}/rendezvous/${rdvId}/compte-rendu`,
        { contenu, diagnostic },
        { headers }
      );
      setExistingCR(res.data);
      setSuccess('Compte rendu enregistré avec succès !');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page"><div className="loading">Chargement...</div></div>;

  return (
    <div className="page compte-rendu-page">
      <div className="page-header">
        <h1>Compte rendu</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/agenda')}>← Retour à l'agenda</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {rdv && (
        <div className="rdv-summary">
          <p><strong>Patient :</strong> {rdv.patientId}</p>
          <p><strong>Date :</strong> {new Date(rdv.date).toLocaleDateString('fr-FR')} à {rdv.heure}</p>
          <p><strong>Statut RDV :</strong> <span className={`status-${rdv.statut?.toLowerCase()}`}>{rdv.statut}</span></p>
        </div>
      )}

      {rdv?.statut !== 'TERMINE' && !existingCR && (
        <div className="alert alert-warning">
          Le compte rendu ne peut être rédigé que pour un RDV terminé (statut TERMINE).
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Contenu du compte rendu *</label>
          <textarea
            rows={8}
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            placeholder="Décrivez le déroulement de la consultation, les symptômes observés, l'examen clinique..."
            required
          />
        </div>

        <div className="form-group">
          <label>Diagnostic</label>
          <input
            type="text"
            value={diagnostic}
            onChange={(e) => setDiagnostic(e.target.value)}
            placeholder="Diagnostic posé"
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving || (!existingCR && rdv?.statut !== 'TERMINE')}>
          {saving ? 'Enregistrement...' : existingCR ? 'Mettre à jour le compte rendu' : 'Finaliser le compte rendu'}
        </button>
      </form>

      {existingCR && (
        <div className="existing-cr">
          <h3>Compte rendu existant</h3>
          <p><strong>Finalisé le :</strong> {existingCR.dateFinalisation ? new Date(existingCR.dateFinalisation).toLocaleString('fr-FR') : '—'}</p>
          <p><strong>Contenu :</strong> {existingCR.contenu}</p>
        </div>
      )}
    </div>
  );
}

export default CompteRenduPage;
