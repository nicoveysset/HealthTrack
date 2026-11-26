/**
 * Page d'accueil
 * - visiteur : présentation et accès à la connexion / inscription
 * - connecté : tableau de bord (chiffres du jour, prochains rendez-vous, raccourcis)
 * API : GET /rendezvous (RDV), GET /ordonnances (Ordonnances), GET /utilisateurs/{id} (Utilisateurs)
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth, Role } from '../services/auth';
import { API_URLS } from '../services/api';
import Icon from '../components/Icon';
import { toISODate, addDays, heureFin, STATUTS_RDV, STATUTS_PRATICIEN, SPECIALITES } from '../utils/format';

const RACCOURCIS = {
  [Role.PRATICIEN]: [
    { to: '/agenda', icon: 'calendar', titre: 'Agenda', texte: 'Rendez-vous du jour et de la semaine' },
    { to: '/disponibilites', icon: 'clock', titre: 'Disponibilités', texte: 'Horaires et absences' },
    { to: '/profile', icon: 'user', titre: 'Profil', texte: 'Informations et statut' }
  ],
  [Role.PATIENT]: [
    { to: '/prise-rdv', icon: 'plus', titre: 'Prendre un RDV', texte: 'Trouvez un créneau disponible' },
    { to: '/mes-rendezvous', icon: 'calendar', titre: 'Mes rendez-vous', texte: 'Consultez ou annulez vos RDV' },
    { to: '/mes-ordonnances', icon: 'pill', titre: 'Mes ordonnances', texte: 'Retrouvez vos prescriptions' },
    { to: '/dossier-medical', icon: 'folder', titre: 'Dossier médical', texte: 'Antécédents, allergies, vaccins' },
    { to: '/profile', icon: 'user', titre: 'Profil', texte: 'Médecin traitant et coordonnées' }
  ]
};

const ACTIFS = ['PLANIFIE', 'CONFIRME', 'EN_COURS'];

const salutation = () => (new Date().getHours() >= 18 ? 'Bonsoir' : 'Bonjour');

const heureCourante = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const trierParDate = (a, b) => `${a.date}${a.heure}`.localeCompare(`${b.date}${b.heure}`);

/** RDV non terminés dont le créneau n'est pas encore passé (ou en cours). */
const aVenir = (rdvs) => {
  const aujourdhui = toISODate();
  const maintenant = heureCourante();
  return rdvs
    .filter(r => ACTIFS.includes(r.statut))
    .filter(r => r.date > aujourdhui || (r.date === aujourdhui &&
      (r.statut === 'EN_COURS' || heureFin(r.heure, r.duree) > maintenant)))
    .sort(trierParDate);
};

/** "2026-11-26" → "Aujourd'hui", "Demain" ou "lun. 30 nov." */
const jourRelatif = (iso) => {
  if (iso === toISODate()) return "Aujourd'hui";
  if (iso === toISODate(addDays(new Date(), 1))) return 'Demain';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

function StatTile({ icon, valeur, libelle, ton = 'primary', to }) {
  const contenu = (
    <>
      <span className={`stat-icon stat-${ton}`}><Icon name={icon} /></span>
      <span className="stat-text">
        <span className="stat-value">{valeur}</span>
        <span className="stat-label">{libelle}</span>
      </span>
    </>
  );
  return to
    ? <Link to={to} className="stat-tile">{contenu}</Link>
    : <div className="stat-tile">{contenu}</div>;
}

function ProchainsRdv({ rdvs, praticien, loading, error }) {
  return (
    <section className="dash-panel">
      <div className="dash-panel-header">
        <h3>Prochains rendez-vous</h3>
        <Link to={praticien ? '/agenda' : '/mes-rendezvous'} className="dash-link">
          Tout voir <Icon name="arrow" size={16} />
        </Link>
      </div>
      {loading && <p className="dash-empty">Chargement…</p>}
      {!loading && error && <p className="dash-empty">{error}</p>}
      {!loading && !error && rdvs.length === 0 && (
        <div className="dash-empty">
          <Icon name="calendar" size={32} />
          <p>Aucun rendez-vous à venir.</p>
          {!praticien && <Link to="/prise-rdv" className="btn btn-primary btn-small">Prendre un rendez-vous</Link>}
        </div>
      )}
      {!loading && !error && rdvs.length > 0 && (
        <ul className="next-rdv-list">
          {rdvs.map(r => (
            <li key={r.rdvId} className="next-rdv">
              <div className="next-rdv-date">
                <span className="next-rdv-day">{jourRelatif(r.date)}</span>
                <span className="next-rdv-hour">{r.heure}</span>
              </div>
              <div className="next-rdv-info">
                <strong>
                  {praticien
                    ? (r.patientNom || `Patient ${r.patientId.substring(0, 8)}`)
                    : (r.praticienNom ? `Dr ${r.praticienNom}` : 'Praticien')}
                </strong>
                <span>{r.motif || 'Consultation'} · {r.duree || 30} min</span>
              </div>
              <span className={`pill pill-${r.statut.toLowerCase()}`}>{STATUTS_RDV[r.statut] || r.statut}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Raccourcis({ role }) {
  return (
    <section className="dash-shortcuts">
      {RACCOURCIS[role].map(r => (
        <Link key={r.to} to={r.to} className="shortcut">
          <span className="shortcut-icon"><Icon name={r.icon} /></span>
          <span className="shortcut-text">
            <strong>{r.titre}</strong>
            <small>{r.texte}</small>
          </span>
          <Icon name="arrow" size={18} className="shortcut-arrow" />
        </Link>
      ))}
    </section>
  );
}

function DashboardPraticien({ headers }) {
  const [rdvs, setRdvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const aujourdhui = toISODate();

  useEffect(() => {
    axios.get(`${API_URLS.rdv}/rendezvous`, {
      headers,
      params: { dateDebut: aujourdhui, dateFin: toISODate(addDays(new Date(), 6)), page: 1, limit: 100 }
    })
      .then(res => setRdvs(res.data.items || []))
      .catch(() => setError('Impossible de charger les rendez-vous'))
      .finally(() => setLoading(false));
  }, []);

  const duJour = rdvs.filter(r => r.date === aujourdhui && r.statut !== 'ANNULE');
  const prochains = aVenir(rdvs);
  const prochain = prochains[0];
  const nb = (v) => (loading ? '…' : v);

  return (
    <>
      <div className="stats-grid">
        <StatTile icon="calendar" valeur={nb(duJour.length)} libelle="RDV aujourd'hui" to="/agenda" />
        <StatTile icon="alert" ton="warning" valeur={nb(rdvs.filter(r => r.statut === 'PLANIFIE').length)}
          libelle="À confirmer (7 jours)" to="/agenda" />
        <StatTile icon="check" ton="success" valeur={nb(duJour.filter(r => r.statut === 'TERMINE').length)}
          libelle="Consultations terminées aujourd'hui" />
        <StatTile icon="clock" ton="accent"
          valeur={loading ? '…' : prochain ? prochain.heure : '—'}
          libelle={prochain ? `Prochain patient · ${jourRelatif(prochain.date)}` : 'Aucun patient prévu'} />
      </div>
      <div className="dash-columns">
        <ProchainsRdv rdvs={prochains.slice(0, 5)} praticien loading={loading} error={error} />
        <Raccourcis role={Role.PRATICIEN} />
      </div>
    </>
  );
}

function DashboardPatient({ user, headers }) {
  const [rdvs, setRdvs] = useState([]);
  const [nbOrdonnances, setNbOrdonnances] = useState(null);
  const [medecin, setMedecin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API_URLS.rdv}/rendezvous`, {
      headers, params: { dateDebut: toISODate(), statut: ACTIFS.join(','), page: 1, limit: 100 }
    })
      .then(res => setRdvs(res.data.items || []))
      .catch(() => setError('Impossible de charger les rendez-vous'))
      .finally(() => setLoading(false));

    axios.get(`${API_URLS.ordonnances}/ordonnances`, { headers, params: { statut: 'ACTIVE', page: 1, limit: 1 } })
      .then(res => setNbOrdonnances(res.data.count ?? 0))
      .catch(() => setNbOrdonnances('—'));

    if (user.medecinTraitantId) {
      axios.get(`${API_URLS.utilisateurs}/utilisateurs/${user.medecinTraitantId}`, { headers })
        .then(res => setMedecin(res.data))
        .catch(() => {});
    }
  }, []);

  const prochains = aVenir(rdvs);
  const prochain = prochains[0];

  return (
    <>
      <div className="stats-grid">
        <StatTile icon="calendar"
          valeur={loading ? '…' : prochain ? prochain.heure : 'Aucun'}
          libelle={prochain ? `Prochain RDV · ${jourRelatif(prochain.date)}` : 'Prochain rendez-vous'}
          to="/mes-rendezvous" />
        <StatTile icon="list" ton="accent" valeur={loading ? '…' : prochains.length}
          libelle="Rendez-vous à venir" to="/mes-rendezvous" />
        <StatTile icon="pill" ton="success" valeur={nbOrdonnances ?? '…'}
          libelle="Ordonnances actives" to="/mes-ordonnances" />
        <StatTile icon="stethoscope" ton="warning"
          valeur={medecin ? `Dr ${medecin.lastName || ''}`.trim() : user.medecinTraitantId ? '…' : 'Non choisi'}
          libelle="Médecin traitant" to="/profile" />
      </div>
      <div className="dash-columns">
        <ProchainsRdv rdvs={prochains.slice(0, 5)} loading={loading} error={error} />
        <Raccourcis role={Role.PATIENT} />
      </div>
    </>
  );
}

function HomePage() {
  const { user, token, isAuthenticated } = useAuth();

  if (!isAuthenticated()) {
    return (
      <div className="page home-page home-public">
        <div className="hero">
          <span className="hero-badge"><Icon name="stethoscope" size={18} /> Cabinet médical connecté</span>
          <h1>Bienvenue sur HealthTrack</h1>
          <p className="subtitle">
            Rendez-vous, dossiers médicaux et ordonnances réunis au même endroit
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn btn-primary btn-large">Se connecter</Link>
            <Link to="/register" className="btn btn-secondary btn-large">S'inscrire</Link>
          </div>
        </div>

        <div className="features">
          <div className="feature">
            <span className="feature-icon"><Icon name="calendar" size={26} /></span>
            <h3>Pour les patients</h3>
            <p>Prendre des rendez-vous, consulter votre dossier médical, retrouver vos ordonnances</p>
          </div>
          <div className="feature">
            <span className="feature-icon"><Icon name="stethoscope" size={26} /></span>
            <h3>Pour les praticiens</h3>
            <p>Gérer votre agenda et vos disponibilités, rédiger comptes rendus et ordonnances</p>
          </div>
          <div className="feature">
            <span className="feature-icon"><Icon name="check" size={26} /></span>
            <h3>Sécurisé et confidentiel</h3>
            <p>Vos données ne sont accessibles qu'aux personnes autorisées</p>
          </div>
        </div>
      </div>
    );
  }

  const praticien = user.type === Role.PRATICIEN;
  const headers = { Authorization: `Bearer ${token}` };
  const dateDuJour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="page home-page dashboard">
      <header className="dash-hero">
        <div className="dash-hero-avatar">
          {(user.firstName?.[0] || '').toUpperCase()}{(user.lastName?.[0] || '').toUpperCase()}
        </div>
        <div className="dash-hero-text">
          <span className="dash-date">{dateDuJour}</span>
          <h1>{salutation()}, {praticien ? 'Dr ' : ''}{user.firstName} {user.lastName} !</h1>
          <div className="dash-tags">
            <span className="dash-tag">{praticien ? 'Espace praticien' : 'Espace patient'}</span>
            {praticien && user.specialite && (
              <span className="dash-tag">{SPECIALITES[user.specialite] || user.specialite}</span>
            )}
            {praticien && user.statut && (
              <span className={`dash-tag dash-statut statut-${user.statut.toLowerCase()}`}>
                <span className="dot" /> {STATUTS_PRATICIEN[user.statut] || user.statut}
              </span>
            )}
          </div>
        </div>
      </header>

      {praticien
        ? <DashboardPraticien headers={headers} />
        : <DashboardPatient user={user} headers={headers} />}
    </div>
  );
}

export default HomePage;
