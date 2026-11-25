/**
 * IndisponibiliteRepository - Couche d'accès aux données pour les indisponibilités
 * 
 * Gère les interactions avec la table DynamoDB healthtrack-indisponibilites.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-indisponibilites";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Crée une nouvelle indisponibilité ponctuelle
 * @param {Object} indispo - Indisponibilité à créer
 * @returns {Promise<Object>} - Indisponibilité créée
 */
async function create(indispo) {
  const params = {
    TableName: TABLE_NAME,
    Item: indispo
  };
  
  await docClient.send(new PutCommand(params));
  return indispo;
}

/**
 * Récupère une indisponibilité par son ID
 * @param {string} indispoId - Identifiant de l'indisponibilité
 * @returns {Promise<Object|null>} - Indisponibilité trouvée ou null
 */
async function getById(indispoId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { indispoId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * Récupère les indisponibilités d'un praticien
 * @param {string} praticienId - ID du praticien
 * @returns {Promise<Array>} - Liste des indisponibilités
 */
async function getByPraticien(praticienId) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byPraticien",
    KeyConditionExpression: "praticienId = :praticienId",
    ExpressionAttributeValues: {
      ":praticienId": praticienId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Récupère les indisponibilités d'un praticien pour une date spécifique
 * @param {string} praticienId - ID du praticien
 * @param {string} date - Date (format YYYY-MM-DD)
 * @returns {Promise<Array>} - Liste des indisponibilités pour cette date
 */
async function getByPraticienAndDate(praticienId, date) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byPraticienAndDate",
    KeyConditionExpression: "praticienId = :praticienId AND dateDebut = :date",
    ExpressionAttributeValues: {
      ":praticienId": praticienId,
      ":date": date
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Supprime une indisponibilité
 * @param {string} indispoId - Identifiant de l'indisponibilité
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteById(indispoId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { indispoId }
  };
  
  await docClient.send(new DeleteCommand(params));
  return { success: true };
}

/**
 * Liste toutes les indisponibilités avec filtres optionnels
 * @param {Object} filters - Filtres à appliquer
 * @returns {Promise<Array>} - Liste des indisponibilités
 */
async function list(filters = {}) {
  const { praticienId, dateDebut, dateFin } = filters;
  
  let params = {
    TableName: TABLE_NAME
  };
  
  if (praticienId) {
    params.IndexName = "byPraticien";
    params.KeyConditionExpression = "praticienId = :praticienId";
    params.ExpressionAttributeValues = {
      ":praticienId": praticienId
    };
  }
  
  const result = await docClient.send(new ScanCommand(params));
  
  // Filtrer par date si nécessaire
  let items = result.Items || [];
  if (dateDebut) {
    items = items.filter(i => i.dateDebut >= dateDebut);
  }
  if (dateFin) {
    items = items.filter(i => i.dateFin <= dateFin);
  }
  
  return items;
}

/**
 * Vérifie si une date/heure chevauche avec des indisponibilités
 * @param {string} praticienId - ID du praticien
 * @param {Date} dateDebut - Date/heure de début du créneau
 * @param {Date} dateFin - Date/heure de fin du créneau
 * @returns {Promise<boolean>} - true si indisponible
 */
async function isIndisponible(praticienId, dateDebut, dateFin) {
  const indisponibilites = await getByPraticien(praticienId);
  
  for (const indispo of indisponibilites) {
    const indispoDebut = new Date(indispo.dateDebut);
    const indispoFin = new Date(indispo.dateFin);
    
    if (dateDebut < indispoFin && dateFin > indispoDebut) {
      return true;
    }
  }
  
  return false;
}

module.exports = {
  create,
  getById,
  getByPraticien,
  getByPraticienAndDate,
  deleteById,
  list,
  isIndisponible
};
