/**
 * DisponibiliteRepository - Couche d'accès aux données pour les disponibilités
 * 
 * Gère les interactions avec la table DynamoDB healthtrack-disponibilites.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-disponibilites";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Crée une nouvelle disponibilité hebdomadaire
 * @param {Object} dispo - Disponibilité à créer
 * @returns {Promise<Object>} - Disponibilité créée
 */
async function create(dispo) {
  const params = {
    TableName: TABLE_NAME,
    Item: dispo
  };
  
  await docClient.send(new PutCommand(params));
  return dispo;
}

/**
 * Récupère une disponibilité par son ID
 * @param {string} dispoId - Identifiant de la disponibilité
 * @returns {Promise<Object|null>} - Disponibilité trouvée ou null
 */
async function getById(dispoId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { dispoId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * Récupère les disponibilités d'un praticien
 * @param {string} praticienId - ID du praticien
 * @returns {Promise<Array>} - Liste des disponibilités
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
 * Récupère les disponibilités d'un praticien pour un jour spécifique
 * @param {string} praticienId - ID du praticien
 * @param {string} jourSemaine - Jour de la semaine
 * @returns {Promise<Array>} - Liste des disponibilités pour ce jour
 */
async function getByPraticienAndJour(praticienId, jourSemaine) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byPraticienAndJour",
    KeyConditionExpression: "praticienId = :praticienId AND jourSemaine = :jourSemaine",
    ExpressionAttributeValues: {
      ":praticienId": praticienId,
      ":jourSemaine": jourSemaine
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Supprime une disponibilité
 * @param {string} dispoId - Identifiant de la disponibilité
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteById(dispoId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { dispoId }
  };
  
  await docClient.send(new DeleteCommand(params));
  return { success: true };
}

/**
 * Supprime toutes les disponibilités d'un praticien
 * @param {string} praticienId - ID du praticien
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteAllByPraticien(praticienId) {
  const dispos = await getByPraticien(praticienId);
  
  for (const dispo of dispos) {
    await deleteById(dispo.dispoId);
  }
  
  return { success: true };
}

/**
 * Liste toutes les disponibilités avec filtres optionnels
 * @param {Object} filters - Filtres à appliquer
 * @returns {Promise<Array>} - Liste des disponibilités
 */
async function list(filters = {}) {
  const { praticienId, jourSemaine } = filters;
  
  let params = {
    TableName: TABLE_NAME
  };
  
  if (praticienId && jourSemaine) {
    params.IndexName = "byPraticienAndJour";
    params.KeyConditionExpression = "praticienId = :praticienId AND jourSemaine = :jourSemaine";
    params.ExpressionAttributeValues = {
      ":praticienId": praticienId,
      ":jourSemaine": jourSemaine
    };
  } else if (praticienId) {
    params.IndexName = "byPraticien";
    params.KeyConditionExpression = "praticienId = :praticienId";
    params.ExpressionAttributeValues = {
      ":praticienId": praticienId
    };
  }
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

module.exports = {
  create,
  getById,
  getByPraticien,
  getByPraticienAndJour,
  deleteById,
  deleteAllByPraticien,
  list
};
