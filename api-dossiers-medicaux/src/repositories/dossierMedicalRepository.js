/**
 * DossierMedicalRepository - Couche d'accès aux données pour les dossiers médicaux
 * 
 * Gère les interactions avec la table DynamoDB healthtrack-dossiers-medicaux.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-dossiers-medicaux";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Crée un nouveau dossier médical
 * @param {Object} dossier - Dossier médical à créer
 * @returns {Promise<Object>} - Dossier médical créé
 */
async function create(dossier) {
  const params = {
    TableName: TABLE_NAME,
    Item: dossier
  };
  
  await docClient.send(new PutCommand(params));
  return dossier;
}

/**
 * Récupère un dossier médical par ID de patient
 * @param {string} patientId - ID du patient
 * @returns {Promise<Object|null>} - Dossier médical trouvé ou null
 */
async function getByPatientId(patientId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { patientId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * Met à jour un dossier médical
 * @param {string} patientId - ID du patient
 * @param {Object} updates - Champs à mettre à jour
 * @returns {Promise<Object>} - Dossier médical mis à jour
 */
async function update(patientId, updates) {
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
    Key: { patientId },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW"
  };
  
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Vérifie si un dossier médical existe
 * @param {string} patientId - ID du patient
 * @returns {Promise<boolean>} - true si le dossier existe
 */
async function exists(patientId) {
  const dossier = await getByPatientId(patientId);
  return dossier !== null;
}

/**
 * Crée un dossier médical s'il n'existe pas
 * @param {string} patientId - ID du patient
 * @param {Object} data - Données initiales
 * @returns {Promise<Object>} - Dossier médical créé ou existant
 */
async function createIfNotExists(patientId, data = {}) {
  const now = new Date().toISOString();
  
  const existingDossier = await getByPatientId(patientId);
  if (existingDossier) {
    return existingDossier;
  }
  
  const dossier = {
    patientId,
    groupeSanguin: data.groupeSanguin || "",
    dateCreation: now,
    updatedAt: now,
    ...data
  };
  
  return await create(dossier);
}

module.exports = {
  create,
  getByPatientId,
  update,
  exists,
  createIfNotExists
};
