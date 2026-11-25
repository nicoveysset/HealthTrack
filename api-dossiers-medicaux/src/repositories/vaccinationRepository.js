/**
 * VaccinationRepository - Couche d'accès aux données pour les vaccinations
 * 
 * Gère les interactions avec la table DynamoDB healthtrack-vaccinations.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-vaccinations";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Crée une nouvelle vaccination
 * @param {Object} vaccination - Vaccination à créer
 * @returns {Promise<Object>} - Vaccination créée
 */
async function create(vaccination) {
  const params = {
    TableName: TABLE_NAME,
    Item: vaccination
  };
  
  await docClient.send(new PutCommand(params));
  return vaccination;
}

/**
 * Récupère une vaccination par son ID
 * @param {string} vaccinationId - Identifiant de la vaccination
 * @returns {Promise<Object|null>} - Vaccination trouvée ou null
 */
async function getById(vaccinationId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { vaccinationId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * Récupère les vaccinations d'un dossier (patient)
 * @param {string} dossierId - ID du dossier (même que patientId)
 * @returns {Promise<Array>} - Liste des vaccinations
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
 * Récupère les vaccinations d'un patient par nom de vaccin
 * @param {string} dossierId - ID du dossier
 * @param {string} nomVaccin - Nom du vaccin
 * @returns {Promise<Array>} - Liste des vaccinations pour ce vaccin
 */
async function getByDossierAndNom(dossierId, nomVaccin) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byDossierAndNom",
    KeyConditionExpression: "dossierId = :dossierId AND nomVaccin = :nomVaccin",
    ExpressionAttributeValues: {
      ":dossierId": dossierId,
      ":nomVaccin": nomVaccin
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Met à jour une vaccination
 * @param {string} vaccinationId - Identifiant de la vaccination
 * @param {Object} updates - Champs à mettre à jour
 * @returns {Promise<Object>} - Vaccination mise à jour
 */
async function update(vaccinationId, updates) {
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
    Key: { vaccinationId },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW"
  };
  
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Supprime une vaccination
 * @param {string} vaccinationId - Identifiant de la vaccination
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteById(vaccinationId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { vaccinationId }
  };
  
  await docClient.send(new DeleteCommand(params));
  return { success: true };
}

/**
 * Vérifie si une vaccination existe pour un patient
 * @param {string} dossierId - ID du dossier
 * @param {string} nomVaccin - Nom du vaccin
 * @returns {Promise<boolean>} - true si la vaccination existe
 */
async function exists(dossierId, nomVaccin) {
  const vaccinations = await getByDossierAndNom(dossierId, nomVaccin);
  return vaccinations.length > 0;
}

/**
 * Récupère les vaccinations à rappel
 * @param {string} dossierId - ID du dossier
 * @returns {Promise<Array>} - Liste des vaccinations nécessitant un rappel
 */
async function getVaccinationsARappel(dossierId) {
  const vaccinations = await getByDossier(dossierId);
  const now = new Date().toISOString();
  
  return vaccinations.filter(v => {
    // Vérifier si la date de rappel est passée ou proche
    if (!v.rappelPrévu) return false;
    const rappelDate = new Date(v.rappelPrévu);
    const nowDate = new Date(now);
    
    // Rappel nécessaire dans les 30 jours
    const thirtyDaysFromNow = new Date(nowDate);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    return rappelDate <= thirtyDaysFromNow;
  });
}

module.exports = {
  create,
  getById,
  getByDossier,
  getByDossierAndNom,
  update,
  deleteById,
  exists,
  getVaccinationsARappel
};
