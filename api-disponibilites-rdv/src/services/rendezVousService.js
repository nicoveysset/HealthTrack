/**
 * RendezVousService - Service pour la gestion des rendez-vous
 * 
 * Contient la logique métier pour les rendez-vous, y compris :
 * - Création de RDV
 * - Transitions de statut
 * - Validation des créneaux disponibles
 */

const rendezVousRepository = require("../repositories/rendezVousRepository");
const indisponibiliteService = require("./indisponibiliteService");
const disponibiliteService = require("./disponibiliteService");
const { v4: uuidv4 } = require("uuid");

/**
 * Format d'erreur standard
 */
const formatError = (error, message, statusCode) => ({
  error,
  message,
  statusCode
});

// Durée par défaut d'un créneau en minutes
const DUREE_DEFAULT = 30;

/**
 * Valide un rendez-vous
 * @param {Object} rdv - Rendez-vous à valider
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateRendezVous(rdv) {
  const errors = [];
  
  if (!rdv.praticienId) {
    errors.push("praticienId est requis");
  }
  
  if (!rdv.patientId) {
    errors.push("patientId est requis");
  }
  
  if (!rdv.date) {
    errors.push("date est requis");
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rdv.date)) {
      errors.push("date doit être au format YYYY-MM-DD");
    }
  }
  
  if (!rdv.heure) {
    errors.push("heure est requis");
  } else {
    if (!/^\d{2}:\d{2}$/.test(rdv.heure)) {
      errors.push("heure doit être au format HH:MM");
    }
  }
  
  if (rdv.duree && (rdv.duree <= 0 || rdv.duree > 240)) {
    errors.push("duree doit être comprise entre 1 et 240 minutes");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Vérifie si une date est dans le passé
 * @param {string} dateString - Date au format ISO ou YYYY-MM-DD
 * @returns {boolean} - true si la date est dans le passé
 */
function isPastDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  date.setMilliseconds(0);
  now.setMilliseconds(0);
  return date < now;
}

/**
 * Vérifie si un créneau est disponible
 * @param {string} praticienId - ID du praticien
 * @param {string} date - Date (format YYYY-MM-DD)
 * @param {string} heure - Heure (format HH:MM)
 * @param {number} duree - Durée en minutes
 * @param {string|null} excludedRdvId - ID du RDV à exclure
 * @returns {Promise<boolean>} - true si le créneau est disponible
 */
async function isCreneauDisponible(praticienId, date, heure, duree = DUREE_DEFAULT, excludedRdvId = null) {
  // 1. Vérifier que le créneau ne chevauche pas avec des indisponibilités
  const creneauDebut = new Date(date + 'T' + heure);
  const creneauFin = new Date(creneauDebut.getTime() + duree * 60000);
  
  const isIndispo = await indisponibiliteService.isIndisponible(praticienId, creneauDebut, creneauFin);
  if (isIndispo) {
    return false;
  }
  
  // 2. Vérifier que le créneau ne chevauche pas avec des RDV existants
  const isPris = await rendezVousRepository.isCreneauPris(praticienId, date, heure, duree, excludedRdvId);
  if (isPris) {
    return false;
  }
  
  // 3. Vérifier que le créneau correspond à une disponibilité
  const jourSemaine = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'][
    new Date(date).getDay()
  ];
  
  const disponibilites = await disponibiliteService.getDisponibilitesByPraticienAndJour(
    praticienId, 
    jourSemaine
  );
  
  // Vérifier si l'heure/heure+duree est dans une plage de disponibilité
  const [heureDebut, minuteDebut] = heure.split(':').map(Number);
  const heureFin = heureDebut * 60 + minuteDebut + duree; // en minutes depuis minuit
  
  for (const dispo of disponibilites) {
    const [dispoHeureDebut, dispoMinuteDebut] = dispo.heureDebut.split(':').map(Number);
    const [dispoHeureFin, dispoMinuteFin] = dispo.heureFin.split(':').map(Number);
    
    const dispoStart = dispoHeureDebut * 60 + dispoMinuteDebut;
    const dispoEnd = dispoHeureFin * 60 + dispoMinuteFin;
    
    // Vérifier si le créneau est entièrement contenu dans la disponibilité
    if (heureDebut * 60 + minuteDebut >= dispoStart && heureFin <= dispoEnd) {
      return true;
    }
  }
  
  return false;
}

/**
 * Crée un nouveau rendez-vous
 * @param {Object} rdvData - Données du rendez-vous
 * @returns {Promise<Object>} - Rendez-vous créé
 */
async function createRendezVous(rdvData) {
  const validation = validateRendezVous(rdvData);
  
  if (!validation.valid) {
    throw formatError("ValidationError", validation.errors.join(", "), 400);
  }
  
  // Vérifier que la date n'est pas dans le passé
  const fullDate = new Date(rdvData.date + 'T' + rdvData.heure);
  if (isPastDate(fullDate.toISOString())) {
    throw formatError("PastDateException", "La date du rendez-vous est dans le passé", 400);
  }
  
  // Vérifier que le créneau est disponible
  const isDisponible = await isCreneauDisponible(
    rdvData.praticienId,
    rdvData.date,
    rdvData.heure,
    rdvData.duree || DUREE_DEFAULT
  );
  
  if (!isDisponible) {
    throw formatError("SlotAlreadyTakenException", "Ce créneau n'est pas disponible", 409);
  }
  
  const now = new Date().toISOString();
  const rdv = {
    rdvId: uuidv4(),
    praticienId: rdvData.praticienId,
    patientId: rdvData.patientId,
    date: rdvData.date,
    heure: rdvData.heure,
    duree: rdvData.duree || DUREE_DEFAULT,
    statut: rendezVousRepository.RDV_STATUT.PLANIFIE,
    createdAt: now,
    updatedAt: now
  };
  
  return await rendezVousRepository.create(rdv);
}

/**
 * Récupère un rendez-vous par son ID
 * @param {string} rdvId - ID du rendez-vous
 * @returns {Promise<Object|null>} - Rendez-vous trouvé ou null
 */
async function getRendezVous(rdvId) {
  return await rendezVousRepository.getById(rdvId);
}

/**
 * Liste les rendez-vous avec filtres optionnels
 * @param {Object} filters - Filtres (praticienId, patientId, statut, dateDebut, dateFin)
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} - Liste paginée des rendez-vous
 */
async function listRendezVous(filters = {}, page = 1, limit = 10) {
  return await rendezVousRepository.list(filters, page, limit);
}

/**
 * Met à jour le statut d'un rendez-vous
 * @param {string} rdvId - ID du rendez-vous
 * @param {string} newStatut - Nouveau statut
 * @param {string} currentUserId - ID de l'utilisateur qui effectue l'action
 * @param {string} currentUserType - Type de l'utilisateur (PRATICIEN/PATIENT)
 * @returns {Promise<Object>} - Rendez-vous mis à jour
 */
async function updateRendezVousStatut(rdvId, newStatut, currentUserId, currentUserType) {
  const rdv = await rendezVousRepository.getById(rdvId);
  
  if (!rdv) {
    throw formatError("NotFound", "Rendez-vous non trouvé", 404);
  }
  
  // Vérifier que l'utilisateur est soit le patient soit le praticien du RDV
  if (rdv.patientId !== currentUserId && rdv.praticienId !== currentUserId) {
    throw formatError("Forbidden", "Vous n'êtes pas autorisé à modifier ce rendez-vous", 403);
  }
  
  // Définir les transitions valides
  const validTransitions = {
    [rendezVousRepository.RDV_STATUT.PLANIFIE]: [
      rendezVousRepository.RDV_STATUT.CONFIRME,
      rendezVousRepository.RDV_STATUT.ANNULE
    ],
    [rendezVousRepository.RDV_STATUT.CONFIRME]: [
      rendezVousRepository.RDV_STATUT.EN_COURS,
      rendezVousRepository.RDV_STATUT.ANNULE
    ],
    [rendezVousRepository.RDV_STATUT.EN_COURS]: [
      rendezVousRepository.RDV_STATUT.TERMINE,
      rendezVousRepository.RDV_STATUT.ANNULE
    ],
    [rendezVousRepository.RDV_STATUT.TERMINE]: [],
    [rendezVousRepository.RDV_STATUT.ANNULE]: [],
    [rendezVousRepository.RDV_STATUT.NON_VENU]: []
  };
  
  // Vérifier la transition
  const allowedTransitions = validTransitions[rdv.statut] || [];
  if (!allowedTransitions.includes(newStatut)) {
    throw formatError(
      "InvalidStateException",
      `Impossible de passer de ${rdv.statut} à ${newStatut}`,
      409
    );
  }
  
  // Vérifications supplémentaires selon le statut
  switch (newStatut) {
    case rendezVousRepository.RDV_STATUT.ANNULE:
      // Vérifier que ce n'est pas trop tard pour annuler
      const rdvDate = new Date(rdv.date + 'T' + rdv.heure);
      const now = new Date();
      const timeUntilRdv = rdvDate - now;
      
      // On ne peut pas annuler moins de 2h avant le RDV
      if (timeUntilRdv < 2 * 60 * 60 * 1000) {
        throw formatError(
          "CancellationTooLateException",
          "Impossible d'annuler un rendez-vous moins de 2 heures avant l'heure prévue",
          409
        );
      }
      break;
    
    case rendezVousRepository.RDV_STATUT.EN_COURS:
      // Seul le praticien peut démarrer un RDV
      if (currentUserType !== 'PRATICIEN' || rdv.praticienId !== currentUserId) {
        throw formatError(
          "Forbidden",
          "Seul le praticien peut démarrer un rendez-vous",
          403
        );
      }
      break;
    
    case rendezVousRepository.RDV_STATUT.TERMINE:
    case rendezVousRepository.RDV_STATUT.NON_VENU:
      // Seul le praticien peut terminer un RDV ou le marquer comme non-venu
      if (currentUserType !== 'PRATICIEN' || rdv.praticienId !== currentUserId) {
        throw formatError(
          "Forbidden",
          "Seul le praticien peut terminer un rendez-vous",
          403
        );
      }
      break;
  }
  
  return await rendezVousRepository.update(rdvId, { statut: newStatut });
}

/**
 * Confirme un rendez-vous
 * @param {string} rdvId - ID du rendez-vous
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Rendez-vous mis à jour
 */
async function confirmerRendezVous(rdvId, currentUserId, currentUserType) {
  return await updateRendezVousStatut(
    rdvId,
    rendezVousRepository.RDV_STATUT.CONFIRME,
    currentUserId,
    currentUserType
  );
}

/**
 * Annule un rendez-vous
 * @param {string} rdvId - ID du rendez-vous
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Rendez-vous mis à jour
 */
async function annulerRendezVous(rdvId, currentUserId, currentUserType) {
  return await updateRendezVousStatut(
    rdvId,
    rendezVousRepository.RDV_STATUT.ANNULE,
    currentUserId,
    currentUserType
  );
}

/**
 * Démarre un rendez-vous
 * @param {string} rdvId - ID du rendez-vous
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Rendez-vous mis à jour
 */
async function demarrerRendezVous(rdvId, currentUserId, currentUserType) {
  return await updateRendezVousStatut(
    rdvId,
    rendezVousRepository.RDV_STATUT.EN_COURS,
    currentUserId,
    currentUserType
  );
}

/**
 * Termine un rendez-vous
 * @param {string} rdvId - ID du rendez-vous
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Rendez-vous mis à jour
 */
async function terminerRendezVous(rdvId, currentUserId, currentUserType) {
  return await updateRendezVousStatut(
    rdvId,
    rendezVousRepository.RDV_STATUT.TERMINE,
    currentUserId,
    currentUserType
  );
}

/**
 * Marque un rendez-vous comme non-venu
 * @param {string} rdvId - ID du rendez-vous
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Rendez-vous mis à jour
 */
async function marquerNonVenu(rdvId, currentUserId, currentUserType) {
  return await updateRendezVousStatut(
    rdvId,
    rendezVousRepository.RDV_STATUT.NON_VENU,
    currentUserId,
    currentUserType
  );
}

/**
 * Calcule les créneaux disponibles pour un praticien
 * @param {string} praticienId - ID du praticien
 * @param {string} dateDebut - Date de début (format YYYY-MM-DD)
 * @param {string} dateFin - Date de fin (format YYYY-MM-DD)
 * @returns {Promise<Array>} - Liste des créneaux disponibles
 */
async function calculateCreneauxDisponibles(praticienId, dateDebut, dateFin) {
  const creneaux = [];
  
  // Récupérer les disponibilités hebdomadaires
  const disponibilites = await disponibiliteService.getDisponibilitesByPraticien(praticienId);
  
  // Récupérer les indisponibilités ponctuelles pour la période
  const indisponibilites = await indisponibiliteService.getIndisponibilitesByPraticien(praticienId);
  
  // Récupérer les rendez-vous existants pour la période
  const rdvs = await rendezVousRepository.list(
    { praticienId, dateDebut, dateFin },
    1,
    1000 // Grand limit pour récupérer tous les RDV de la période
  );
  
  // Pour chaque jour dans la période
  const JOURS_SEMAINE = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
  
  const startDate = new Date(dateDebut);
  const endDate = new Date(dateFin);
  
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const jourSemaine = JOURS_SEMAINE[date.getDay()];
    
    // Trouver les disponibilités pour ce jour
    const dispoPourJour = disponibilites.filter(d => d.jourSemaine === jourSemaine);
    
    // Pour chaque disponibilité
    for (const dispo of dispoPourJour) {
      const [heureDebut, minuteDebut] = dispo.heureDebut.split(':').map(Number);
      const [heureFin, minuteFin] = dispo.heureFin.split(':').map(Number);
      
      const dateDebutDispo = new Date(date);
      dateDebutDispo.setHours(heureDebut, minuteDebut, 0, 0);
      
      const dateFinDispo = new Date(date);
      dateFinDispo.setHours(heureFin, minuteFin, 0, 0);
      
      // Générer des créneaux de 30 minutes
      for (let current = new Date(dateDebutDispo); current < dateFinDispo; current.setMinutes(current.getMinutes() + DUREE_DEFAULT)) {
        const heureFinCreneau = new Date(current);
        heureFinCreneau.setMinutes(current.getMinutes() + DUREE_DEFAULT);
        
        // Vérifier si le créneau est disponible
        const isDisponible = !isCreneauOccupe(
          current,
          heureFinCreneau,
          indisponibilites,
          rdvs.items
        );
        
        if (isDisponible) {
          creneaux.push({
            date: dateStr,
            heure: current.toISOString().substring(11, 16), // HH:MM
            duree: DUREE_DEFAULT
          });
        }
      }
    }
  }
  
  return creneaux;
}

/**
 * Vérifie si un créneau est occupé (indisponibilité ou RDV)
 * @param {Date} dateDebut - Date/heure de début du créneau
 * @param {Date} dateFin - Date/heure de fin du créneau
 * @param {Array} indisponibilites - Liste des indisponibilités
 * @param {Array} rdvs - Liste des rendez-vous
 * @returns {boolean} - true si occupé
 */
function isCreneauOccupe(dateDebut, dateFin, indisponibilites, rdvs) {
  // Vérifier les indisponibilités
  for (const indispo of indisponibilites) {
    const indispoDebut = new Date(indispo.dateDebut);
    const indispoFin = new Date(indispo.dateFin);
    
    if (dateDebut < indispoFin && dateFin > indispoDebut) {
      return true;
    }
  }
  
  // Vérifier les rendez-vous
  for (const rdv of rdvs) {
    const rdvDate = new Date(rdv.date + 'T' + rdv.heure);
    const rdvFin = new Date(rdvDate.getTime() + (rdv.duree || DUREE_DEFAULT) * 60000);
    
    if (dateDebut < rdvFin && dateFin > rdvDate) {
      return true;
    }
  }
  
  return false;
}

/**
 * Vérifie si un praticien a un rendez-vous à un créneau spécifique
 * @param {string} praticienId - ID du praticien
 * @param {string} date - Date (format YYYY-MM-DD)
 * @param {string} heure - Heure (format HH:MM)
 * @returns {Promise<boolean>} - true si occupé
 */
async function hasRendezVousAt(praticienId, date, heure) {
  return await rendezVousRepository.isCreneauPris(praticienId, date, heure, DUREE_DEFAULT);
}

module.exports = {
  RDV_STATUT: rendezVousRepository.RDV_STATUT,
  createRendezVous,
  getRendezVous,
  listRendezVous,
  updateRendezVousStatut,
  confirmerRendezVous,
  annulerRendezVous,
  demarrerRendezVous,
  terminerRendezVous,
  marquerNonVenu,
  calculateCreneauxDisponibles,
  isCreneauDisponible,
  hasRendezVousAt,
  // Exporter pour les tests
  validateRendezVous,
  isPastDate
};
