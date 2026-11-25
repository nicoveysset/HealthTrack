/**
 * LignePrescriptionRepository - Couche d'accès aux données pour les lignes de prescription
 * 
 * Gère les interactions avec la table DynamoDB healthtrack-lignes-prescription.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-lignes-prescription";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Crée une nouvelle ligne de prescription
 * @param {Object} ligne - Ligne de prescription à créer
 * @returns {Promise<Object>} - Ligne de prescription créée
 */
async function create(ligne) {
  const params = {
    TableName: TABLE_NAME,
    Item: ligne
  };
  
  await docClient.send(new PutCommand(params));
  return ligne;
}

/**
 * Récupère une ligne de prescription par son ID
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @param {string} ligneId - ID de la ligne
 * @returns {Promise<Object|null>} - Ligne de prescription trouvée ou null
 */
async function getById(ordonnanceId, ligneId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      ordonnanceId,
      ligneId
    }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * Récupère toutes les lignes de prescription d'une ordonnance
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @returns {Promise<Array>} - Liste des lignes de prescription
 */
async function getByOrdonnance(ordonnanceId) {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: "ordonnanceId = :ordonnanceId",
    ExpressionAttributeValues: {
      ":ordonnanceId": ordonnanceId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Met à jour une ligne de prescription
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @param {string} ligneId - ID de la ligne
 * @param {Object} updates - Champs à mettre à jour
 * @returns {Promise<Object>} - Ligne de prescription mise à jour
 */
async function update(ordonnanceId, ligneId, updates) {
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
    Key: {
      ordonnanceId,
      ligneId
    },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW"
  };
  
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Supprime une ligne de prescription
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @param {string} ligneId - ID de la ligne
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteById(ordonnanceId, ligneId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      ordonnanceId,
      ligneId
    }
  };
  
  await docClient.send(new DeleteCommand(params));
  return { success: true };
}

/**
 * Supprime toutes les lignes d'une ordonnance
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteAllByOrdonnance(ordonnanceId) {
  const lignes = await getByOrdonnance(ordonnanceId);
  
  for (const ligne of lignes) {
    await deleteById(ordonnanceId, ligne.ligneId);
  }
  
  return { success: true };
}

/**
 * Vérifie si une ordonnance a des lignes
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @returns {Promise<boolean>} - true si l'ordonnance a des lignes
 */
async function hasLignes(ordonnanceId) {
  const lignes = await getByOrdonnance(ordonnanceId);
  return lignes.length > 0;
}

/**
 * Compte le nombre de lignes d'une ordonnance
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @returns {Promise<number>} - Nombre de lignes
 */
async function countByOrdonnance(ordonnanceId) {
  const lignes = await getByOrdonnance(ordonnanceId);
  return lignes.length;
}

module.exports = {
  create,
  getById,
  getByOrdonnance,
  update,
  deleteById,
  deleteAllByOrdonnance,
  hasLignes,
  countByOrdonnance
};
