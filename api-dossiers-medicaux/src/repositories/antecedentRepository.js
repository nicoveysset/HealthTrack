/**
 * AntecedentRepository - Couche d'accès aux données pour les antécédents
 * 
 * Gère les interactions avec la table DynamoDB healthtrack-antecedents.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-antecedents";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

// Types et statuts
const ANTECEDENT_TYPE = {
  CHRONIQUE: 'CHRONIQUE',
  PONCTUEL: 'PONCTUEL'
};

const ANTECEDENT_STATUT = {
  ACTIF: 'ACTIF',
  ARCHIVE: 'ARCHIVE'
};

/**
 * Crée un nouvel antécédent
 * @param {Object} antecedent - Antécédent à créer
 * @returns {Promise<Object>} - Antécédent créé
 */
async function create(antecedent) {
  const params = {
    TableName: TABLE_NAME,
    Item: antecedent
  };
  
  await docClient.send(new PutCommand(params));
  return antecedent;
}

/**
 * Récupère un antécédent par son ID
 * @param {string} antecedentId - Identifiant de l'antécédent
 * @returns {Promise<Object|null>} - Antécédent trouvé ou null
 */
async function getById(antecedentId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { antecedentId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * Récupère les antécédents d'un dossier (patient)
 * @param {string} dossierId - ID du dossier (même que patientId)
 * @returns {Promise<Array>} - Liste des antécédents
 */
async function getByDossier(dossierId) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byDossier",
    KeyConditionExpression: "dossierId = :dossierId",
    ExpressionAttributeValues: {
      ":dossierId": dossierId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Récupère les antécédents d'un patient par type
 * @param {string} dossierId - ID du dossier
 * @param {string} type - Type (CHRONIQUE ou PONCTUEL)
 * @returns {Promise<Array>} - Liste des antécédents de ce type
 */
async function getByDossierAndType(dossierId, type) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byDossierAndType",
    KeyConditionExpression: "dossierId = :dossierId AND #type = :type",
    ExpressionAttributeNames: {
      "#type": "type"
    },
    ExpressionAttributeValues: {
      ":dossierId": dossierId,
      ":type": type
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Récupère les antécédents par statut
 * @param {string} statut - Statut (ACTIF ou ARCHIVE)
 * @returns {Promise<Array>} - Liste des antécédents avec ce statut
 */
async function getByStatut(statut) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byStatut",
    KeyConditionExpression: "statut = :statut",
    ExpressionAttributeValues: {
      ":statut": statut
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Met à jour un antécédent
 * @param {string} antecedentId - Identifiant de l'antécédent
 * @param {Object} updates - Champs à mettre à jour
 * @returns {Promise<Object>} - Antécédent mis à jour
 */
async function update(antecedentId, updates) {
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
    Key: { antecedentId },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW"
  };
  
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Supprime un antécédent
 * @param {string} antecedentId - Identifiant de l'antécédent
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteById(antecedentId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { antecedentId }
  };
  
  await docClient.send(new DeleteCommand(params));
  return { success: true };
}

/**
 * Archive un antécédent
 * @param {string} antecedentId - Identifiant de l'antécédent
 * @returns {Promise<Object>} - Antécédent archivé
 */
async function archive(antecedentId) {
  return await update(antecedentId, { statut: ANTECEDENT_STATUT.ARCHIVE });
}

/**
 * Vérifie si un antécédent est chronique
 * @param {string} antecedentId - Identifiant de l'antécédent
 * @returns {Promise<boolean>} - true si l'antécédent est chronique
 */
async function isChronique(antecedentId) {
  const antecedent = await getById(antecedentId);
  return antecedent && antecedent.type === ANTECEDENT_TYPE.CHRONIQUE;
}

module.exports = {
  ANTECEDENT_TYPE,
  ANTECEDENT_STATUT,
  create,
  getById,
  getByDossier,
  getByDossierAndType,
  getByStatut,
  update,
  deleteById,
  archive,
  isChronique
};
