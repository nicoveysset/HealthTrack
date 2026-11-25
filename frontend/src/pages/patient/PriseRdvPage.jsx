/**
 * Page Prise de RDV (Patient)
 * Permet au patient de voir les créneaux disponibles d'un praticien et de prendre RDV
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../services/auth';
import { API_URLS } from '../../services/api';
import axios from 'axios';

function PriseRdvPage() {
  const { user, token } = useAuth();
  const [praticiens, setPraticiens] = useState([]);
  const [selectedPraticien, setSelectedPraticien] = useState(null);
  const [creneaux, setCreneaux] = useState([]);
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().split('T')[0]);
  const [dateFin, setDateFin] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedCreneau, setSelectedCreneau] = useState(null);
  const [motif, setMotif] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  // Charger la liste des praticiens
  useEffect(() => {
    const fetchPraticiens = async () => {
      try {
        const res = await axios.get(`${API_URLS.utilisateurs}/praticiens`, {
          headers,
          params: { statut: 'ACTIF', limit: 50 }
        });
        setPraticiens(res.data.items || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur lors du chargement des praticiens');
      }
    };
    fetchPraticiens();
  }, [token]);

  // Charger les créneaux du praticien sélectionné
  const fetchCreneaux = useCallback(async () => {
    if (!selectedPraticien) return;
    setLoading(true);
    setError(null);
    setCreneaux([]);
    setSelectedCreneau(null);

    try {
      const res = await axios.get(
        `${API_URLS.rdv}/praticiens/${selectedPraticien.userId}/creneaux`,
        { headers, params: { dateDebut, dateFin } }
      );
      const allCreneaux = res.data || [];
      setCreneaux(allCreneaux.filter(c => c.disponible));
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des créneaux');
    } finally {
      setLoading(false);
    }
  }, [selectedPraticien, dateDebut, dateFin, token]);

  useEffect(() => {
    fetchCreneaux();
  }, [fetchCreneaux]);

  // Prendre un RDV
  const handlePrendreRdv = async () => {
    if (!selectedCreneau) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await axios.post(
        `${API_URLS.rdv}/rendezvous`,
        {
          praticienId: selectedPraticien.userId,
          date: selectedCreneau.date,
          heure: selectedCreneau.heure,
          motif: motif || 'Consultation'
        },
        { headers }
      );
      setSuccess('Rendez-vous pris avec succès !');
      setSelectedCreneau(null);
      setMotif('');
      fetchCreneaux();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la prise de RDV');
    } finally {
      setLoading(false);
    }
  };

  // Grouper les créneaux par date
  const creneauxByDate = creneaux.reduce((acc, c) => {
    if (!acc[c.date]) acc[c.date] = [];
    acc[c.date].push(c);
    return acc;
  }, {});

  return (
    <div className="page prise-rdv-page">
      <div className="page-header">
        <h1>Prendre un rendez-vous</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="prise-rdv-form">
        <div className="form-group">
          <label>Praticien</label>
          <select
            value={selectedPraticien?.userId || ''}
            onChange={(e) => {
              const p = praticiens.find(pr => pr.userId === e.target.value);
              setSelectedPraticien(p || null);
            }}
          >
            <option value="">— Choisir un praticien —</option>
            {praticiens.map(p => (
              <option key={p.userId} value={p.userId}>
                Dr {p.firstName} {p.lastName} {p.specialite ? `(${p.specialite})` : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedPraticien && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Du</label>
                <input
                  type="date"
                  value={dateDebut}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDateDebut(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Au</label>
                <input
                  type="date"
                  value={dateFin}
                  min={dateDebut}
                  onChange={(e) => setDateFin(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="loading">Chargement des créneaux...</div>
            ) : creneaux.length === 0 ? (
              <div className="no-data">Aucun créneau disponible pour cette période.</div>
            ) : (
              <div className="creneaux-list">
                {Object.entries(creneauxByDate).map(([date, crs]) => (
                  <div key={date} className="creneaux-day">
                    <h4>{new Date(date).toLocaleDateString('fr-FR', {
                      weekday: 'long', day: 'numeric', month: 'long'
                    })}</h4>
                    <div className="creneaux-grid">
                      {crs.sort((a, b) => a.heure.localeCompare(b.heure)).map(c => (
                        <button
                          key={`${c.date}-${c.heure}`}
                          className={`creneau-btn ${selectedCreneau?.heure === c.heure && selectedCreneau?.date === c.date ? 'selected' : ''}`}
                          onClick={() => setSelectedCreneau(c)}
                        >
                          {c.heure}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedCreneau && (
              <div className="rdv-confirmation">
                <h3>Confirmer le rendez-vous</h3>
                <p>
                  <strong>Date :</strong> {new Date(selectedCreneau.date).toLocaleDateString('fr-FR')} à {selectedCreneau.heure}
                </p>
                <p><strong>Praticien :</strong> Dr {selectedPraticien.firstName} {selectedPraticien.lastName}</p>
                <div className="form-group">
                  <label>Motif</label>
                  <input
                    type="text"
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder="Motif de la consultation"
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handlePrendreRdv}
                  disabled={loading}
                >
                  {loading ? 'En cours...' : 'Confirmer le RDV'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default PriseRdvPage;
