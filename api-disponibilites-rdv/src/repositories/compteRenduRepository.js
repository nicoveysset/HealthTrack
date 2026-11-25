/**
 * CompteRenduRepository - Couche d'accès aux données pour les comptes rendus
 * 
 * Gère les interactions avec la table DynamoDB healthtrack-comptes-rendus.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-comptes-rendus";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Crée un nouveau compte rendu
 * @param {Object} cr - Compte rendu à créer
 * @returns {Promise<Object>} - Compte rendu créé
 */
async function create(cr) {
  const params = {
    TableName: TABLE_NAME,
    Item: cr
  };
  
  await docClient.send(new PutCommand(params));
  return cr;
}

/**
 * Récupère un compte rendu par son ID
 * @param {string} compteRenduId - Identifiant du compte rendu
 * @returns {Promise<Object|null>} - Compte rendu trouvé ou null
 */
async function getById(compteRenduId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { compteRenduId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * Récupère un compte rendu par ID de rendez-vous
 * @param {string} rdvId - ID du rendez-vous
 * @returns {Promise<Object|null>} - Compte rendu trouvé ou null
 */
async function getByRdvId(rdvId) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byRdv",
    KeyConditionExpression: "rdvId = :rdvId",
    ExpressionAttributeValues: {
      ":rdvId": rdvId
    },
    Limit: 1
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items ? result.Items[0] : null;
}

/**
 * Récupère les comptes rendus d'un praticien
 * @param {string} praticienId - ID du praticien
 * @returns {Promise<Array>} - Liste des comptes rendus
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
 * Récupère les comptes rendus d'un patient
 * @param {string} patientId - ID du patient
 * @returns {Promise<Array>} - Liste des comptes rendus
 */
async function getByPatient(patientId) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byPatient",
    KeyConditionExpression: "patientId = :patientId",
    ExpressionAttributeValues: {
      ":patientId": patientId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Met à jour un compte rendu
 * @param {string} compteRenduId - Identifiant du compte rendu
 * @param {Object} updates - Champs à mettre à jour
 * @returns {Promise<Object>} - Compte rendu mis à jour
 */
async function update(compteRenduId, updates) {
  const updateExpressionParts = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};
  
  for (const [key, value] of Object.entries(updates)) {
    updateExpressionParts.push(`#${key} = :${key}`);
    expressionAttributeNames[`#${key}`] = key;
    expressionAttributeValues[`:${key}`] = value;
  }
  
  const params = {
    TableName: TABLE_NAME,
    Key: { compteRenduId },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW"
  };
  
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Supprime un compte rendu
 * @param {string} compteRenduId - Identifiant du compte rendu
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteById(compteRenduId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { compteRenduId }
  };
  
  await docClient.send(new DeleteCommand(params));
  return { success: true };
}

/**
 * Liste les comptes rendus avec filtres optionnels
 * @param {Object} filters - Filtres (praticienId, patientId, rdvId)
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} - Liste paginée des comptes rendus
 */
async function list(filters = {}, page = 1, limit = 10) {
  const { praticienId, patientId, rdvId } = filters;
  
  let params = {
    TableName: TABLE_NAME,
    Limit: limit
  };
  
  let indexName = null;
  let keyCondition = null;
  const expressionAttributeValues = {};
  
  if (rdvId) {
    indexName = "byRdv";
    keyCondition = "rdvId = :rdvId";
    expressionAttributeValues[":rdvId"] = rdvId;
  } else if (praticienId) {
    indexName = "byPraticien";
    keyCondition = "praticienId = :praticienId";
    expressionAttributeValues[":praticienId"] = praticienId;
  } else if (patientId) {
    indexName = "byPatient";
    keyCondition = "patientId = :patientId";
    expressionAttributeValues[":patientId"] = patientId;
  }
  
  if (indexName && keyCondition) {
    params.IndexName = indexName;
    params.KeyConditionExpression = keyCondition;
    params.ExpressionAttributeValues = expressionAttributeValues;
  }
  
  const result = await docClient.send(new QueryCommand(params));
  
  return {
    items: result.Items || [],
    count: result.Items ? result.Items.length : 0,
    page: parseInt(page),
    limit: parseInt(limit)
  };
}

/**
 * Vérifie si un compte rendu existe déjà pour un RDV
 * @param {string} rdvId - ID du rendez-vous
 * @returns {Promise<boolean>} - true si un compte rendu existe
 */
async function existsByRdvId(rdvId) {
  const cr = await getByRdvId(rdvId);
  return cr !== null;
}

module.exports = {
  create,
  getById,
  getByRdvId,
  getByPraticien,
  getByPatient,
  update,
  deleteById,
  list,
  existsByRdvId
};
