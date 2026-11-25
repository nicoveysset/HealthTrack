/**
 * Page Agenda du praticien
 * Affiche les rendez-vous du jour et de la semaine
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../services/auth';
import { useApiRequest } from '../../services/api';
import { API_URLS } from '../../services/api';

/**
 * Page Agenda du praticien
 */
function PraticienAgendaPage() {
  const { user, token } = useAuth();
  const { request, handleApiError } = useApiRequest();
  const [rendezvous, setRendezvous] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [date, setDate] = useState(new Date());

  // Charger les rendez-vous
  useEffect(() => {
    const fetchRendezvous = async () => {
      setLoading(true);
      setError(null);

      try {
        const today = date.toISOString().split('T')[0];
        const nextWeek = new Date(date);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString().split('T')[0];

        const { data, error: apiError } = await request(
          'GET',
          `${API_URLS.rdv}/rendezvous`,
          null,
          {
            praticienId: user.userId,
            dateDebut: today,
            dateFin: nextWeekStr,
            statut: 'CONFIRME,PLANIFIE,EN_COURS'
          }
        );

        if (apiError) {
          throw apiError;
        }

        setRendezvous(data.items || []);
      } catch (err) {
        setError(handleApiError(err).message);
      } finally {
        setLoading(false);
      }
    };

    if (user?.userId) {
      fetchRendezvous();
    }
  }, [user, date, request, handleApiError]);

  // Grouper les rendez-vous par jour
  const groupByDay = (rdvs) => {
    const grouped = {};
    
    rdvs.forEach(rdv => {
      const day = new Date(rdv.date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      if (!grouped[day]) {
        grouped[day] = [];
      }
      grouped[day].push(rdv);
    });

    return grouped;
  };

  const rdvByDay = groupByDay(rendezvous);

  const getRdvStatusColor = (statut) => {
    switch (statut) {
      case 'CONFIRME':
        return 'status-confirmé';
      case 'PLANIFIE':
        return 'status-planifié';
      case 'EN_COURS':
        return 'status-en-cours';
      case 'TERMINE':
        return 'status-terminé';
      case 'ANNULE':
        return 'status-annulé';
      case 'NON_VENU':
        return 'status-non-venu';
      default:
        return '';
    }
  };

  const formatTime = (heure) => {
    const [hours, minutes] = heure.split(':');
    return `${hours}:${minutes}`;
  };

  return (
    <div className="page agenda-page">
      <div className="page-header">
        <h1>Mon agenda</h1>
        
        <div className="date-navigator">
          <button 
            className="btn btn-icon"
            onClick={() => setDate(new Date(date.setDate(date.getDate() - 1)))}
          >
            ‹
          </button>
          
          <span className="current-date">
            {date.toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
          
          <button 
            className="btn btn-icon"
            onClick={() => setDate(new Date(date.setDate(date.getDate() + 1)))}
          >
            ›
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">Chargement des rendez-vous...</div>
      ) : (
        <div className="agenda-content">
          {Object.keys(rdvByDay).length === 0 ? (
            <div className="no-rendezvous">
              <p>Aucun rendez-vous trouvé pour cette période.</p>
            </div>
          ) : (
            Object.entries(rdvByDay).map(([day, rdvs]) => (
              <div key={day} className="agenda-day">
                <h3>{day}</h3>
                
                <div className="rendezvous-list">
                  {rdvs.sort((a, b) => new Date(a.heure) - new Date(b.heure)).map(rdv => (
                    <div key={rdv.rdvId} className={`rendezvous-card ${getRdvStatusColor(rdv.statut)}`}>
                      <div className="rdv-time">
                        {formatTime(rdv.heure)} - {new Date(new Date(rdv.date + 'T' + rdv.heure).getTime() + rdv.duree * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      
                      <div className="rdv-info">
                        <div className="rdv-patient">
                          Patient: {rdv.patientId}
                        </div>
                        
                        <div className="rdv-duration">
                          Durée: {rdv.duree} min
                        </div>
                        
                        <div className="rdv-status">
                          {rdv.statut}
                        </div>
                      </div>
                      
                      <div className="rdv-actions">
                        {rdv.statut === 'PLANIFIE' && (
                          <button className="btn btn-small btn-success">
                            Confirmer
                          </button>
                        )}
                        
                        {rdv.statut === 'CONFIRME' && (
                          <button className="btn btn-small btn-primary">
                            Commencer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default PraticienAgendaPage;
