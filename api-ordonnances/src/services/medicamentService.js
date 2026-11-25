/**
 * MedicamentService - Service pour la gestion des médicaments
 * 
 * Contient la logique métier pour les médicaments.
 */

const medicamentRepository = require("../repositories/medicamentRepository");
const { v4: uuidv4 } = require("uuid");

/**
 * Format d'erreur standard
 */
const formatError = (error, message, statusCode) => ({
  error,
  message,
  statusCode
});

/**
 * Valide un médicament
 * @param {Object} medicament - Médicament à valider
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateMedicament(medicament) {
  const errors = [];
  
  if (!medicament.nom) {
    errors.push("nom est requis");
  }
  
  if (!medicament.substanceActive) {
    errors.push("substanceActive est requis");
  }
  
  if (!medicament.forme) {
    errors.push("forme est requis");
  } else if (!Object.values(medicamentRepository.MEDICAMENT_FORME).includes(medicament.forme)) {
    errors.push(`forme doit être ${Object.values(medicamentRepository.MEDICAMENT_FORME).join(' ou ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Crée un nouveau médicament
 * @param {Object} medicamentData - Données du médicament
 * @returns {Promise<Object>} - Médicament créé
 */
async function createMedicament(medicamentData) {
  const validation = validateMedicament(medicamentData);
  
  if (!validation.valid) {
    throw formatError("ValidationError", validation.errors.join(", "), 400);
  }
  
  // Vérifier que le médicament n'existe pas déjà
  const existing = await medicamentRepository.exists(medicamentData.nom);
  if (existing) {
    throw formatError(
      "Conflict",
      "Un médicament avec ce nom existe déjà",
      409
    );
  }
  
  const now = new Date().toISOString();
  const medicament = {
    medicamentId: uuidv4(),
    nom: medicamentData.nom,
    substanceActive: medicamentData.substanceActive,
    forme: medicamentData.forme,
    description: medicamentData.description || "",
    createdAt: now,
    updatedAt: now
  };
  
  return await medicamentRepository.create(medicament);
}

/**
 * Récupère un médicament par son ID
 * @param {string} medicamentId - ID du médicament
 * @returns {Promise<Object|null>} - Médicament trouvé ou null
 */
async function getMedicament(medicamentId) {
  const medicament = await medicamentRepository.getById(medicamentId);
  
  if (!medicament) {
    throw formatError("NotFound", "Médicament non trouvé", 404);
  }
  
  return medicament;
}

/**
 * Récupère les médicaments par substance active
 * @param {string} substanceActive - Substance active
 * @returns {Promise<Array>} - Liste des médicaments
 */
async function getMedicamentsBySubstanceActive(substanceActive) {
  return await medicamentRepository.getBySubstanceActive(substanceActive);
}

/**
 * Récupère les médicaments par forme
 * @param {string} forme - Forme du médicament
 * @returns {Promise<Array>} - Liste des médicaments
 */
async function getMedicamentsByForme(forme) {
  if (!Object.values(medicamentRepository.MEDICAMENT_FORME).includes(forme)) {
    throw formatError(
      "ValidationError",
      `forme doit être ${Object.values(medicamentRepository.MEDICAMENT_FORME).join(' ou ')}`,
      400
    );
  }
  
  return await medicamentRepository.getByForme(forme);
}

/**
 * Liste tous les médicaments (paginé)
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} - Liste paginée des médicaments
 */
async function listMedicaments(page = 1, limit = 10) {
  return await medicamentRepository.list(page, limit);
}

/**
 * Recherche des médicaments par nom
 * @param {string} nom - Nom ou partie du nom du médicament
 * @returns {Promise<Array>} - Liste des médicaments correspondants
 */
async function searchMedicaments(nom) {
  if (!nom || nom.length < 2) {
    throw formatError("ValidationError", "nom doit contenir au moins 2 caractères", 400);
  }
  
  return await medicamentRepository.searchByNom(nom);
}

/**
 * Met à jour un médicament
 * @param {string} medicamentId - ID du médicament
 * @param {Object} updates - Champs à mettre à jour
 * @returns {Promise<Object>} - Médicament mis à jour
 */
async function updateMedicament(medicamentId, updates) {
  const medicament = await getMedicament(medicamentId);
  
  // Ne pas permettre de changer le medicamentId
  const safeUpdates = { ...updates };
  delete safeUpdates.medicamentId;
  delete safeUpdates.createdAt;
  
  return await medicamentRepository.update(medicamentId, safeUpdates);
}

/**
 * Supprime un médicament
 * @param {string} medicamentId - ID du médicament
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteMedicament(medicamentId) {
  const medicament = await getMedicament(medicamentId);
  return await medicamentRepository.deleteById(medicamentId);
}

module.exports = {
  MEDICAMENT_FORME: medicamentRepository.MEDICAMENT_FORME,
  createMedicament,
  getMedicament,
  getMedicamentsBySubstanceActive,
  getMedicamentsByForme,
  listMedicaments,
  searchMedicaments,
  updateMedicament,
  deleteMedicament,
  // Exporter pour les tests
  validateMedicament
};
