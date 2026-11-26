/**
 * Utilitaires d'affichage partagés (dates, statuts, messages d'erreur).
 */

/** Date locale au format YYYY-MM-DD (sans passer par l'UTC, contrairement à toISOString). */
export const toISODate = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const addDays = (d, n) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};

/** "2026-11-30" → "lundi 30 novembre 2026" */
export const formatLongDate = (iso) =>
  iso ? new Date(`${iso.substring(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }) : '—';

/** "2026-11-30" → "30/11/2026" */
export const formatDate = (iso) =>
  iso ? new Date(`${iso.substring(0, 10)}T00:00:00`).toLocaleDateString('fr-FR') : '—';

/** Horodatage ISO → "30/11/2026 14:05" */
export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** Heure de fin d'un RDV : "09:30" + 30 min → "10:00" */
export const heureFin = (heure, duree = 30) => {
  const [h, m] = heure.split(':').map(Number);
  const total = h * 60 + m + duree;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export const STATUTS_RDV = {
  PLANIFIE: 'Planifié',
  CONFIRME: 'Confirmé',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
  NON_VENU: 'Non venu'
};

export const STATUT_RDV_CLASS = {
  PLANIFIE: 'status-planifié',
  CONFIRME: 'status-confirmé',
  EN_COURS: 'status-en-cours',
  TERMINE: 'status-terminé',
  ANNULE: 'status-annulé',
  NON_VENU: 'status-non-venu'
};

export const SPECIALITES = {
  GENERALISTE: 'Médecine générale',
  CARDIOLOGUE: 'Cardiologie',
  DERMATOLOGUE: 'Dermatologie',
  PEDIATRE: 'Pédiatrie',
  AUTRE: 'Autre'
};

export const STATUTS_PRATICIEN = {
  ACTIF: 'Actif',
  EN_CONGE: 'En congé',
  INACTIF: 'Inactif'
};

/** Message lisible à partir d'une erreur axios (les APIs renvoient { error, message, statusCode }). */
export const apiError = (err, fallback = 'Une erreur est survenue') => {
  const data = err?.response?.data;
  if (data?.message) return data.message;
  if (err?.response) return `${fallback} (HTTP ${err.response.status})`;
  if (err?.request) return 'Le serveur ne répond pas';
  return fallback;
};
