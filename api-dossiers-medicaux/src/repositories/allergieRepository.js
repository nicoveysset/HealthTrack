/**
 * AllergieRepository - Couche d'accès aux données pour les allergies
 * 
 * Gère les interactions avec la table DynamoDB healthtrack-allergies.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-allergies";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

// Séverités
const ALLERGIE_SEVERITE = {
  LEGERE: 'LEGERE',
  MODEREE: 'MODEREE',
  SEVERE: 'SEVERE'
};

/**
 * Crée une nouvelle allergie
 * @param {Object} allergie - Allergie à créer
 * @returns {Promise<Object>} - Allergie créée
 */
async function create(allergie) {
  const params = {
    TableName: TABLE_NAME,
    Item: allergie
  };
  
  await docClient.send(new PutCommand(params));
  return allergie;
}

/**
 * Récupère une allergie par son ID
 * @param {string} allergieId - Identifiant de l'allergie
 * @returns {Promise<Object|null>} - Allergie trouvée ou null
 */
async function getById(allergieId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { allergieId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * Récupère les allergies d'un patient
 * @param {string} patientId - ID du patient
 * @returns {Promise<Array>} - Liste des allergies
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
 * Met à jour une allergie
 * @param {string} allergieId - Identifiant de l'allergie
 * @param {Object} updates - Champs à mettre à jour
 * @returns {Promise<Object>} - Allergie mise à jour
 */
async function update(allergieId, updates) {
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
    Key: { allergieId },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW"
  };
  
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Supprime une allergie
 * @param {string} allergieId - Identifiant de l'allergie
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteById(allergieId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { allergieId }
  };
  
  await docClient.send(new DeleteCommand(params));
  return { success: true };
}

/**
 * Vérifie si une allergie est liée à une ordonnance active
 * (Nécessite d'interroger les tables ordonnances et lignes-prescription)
 * @param {string} allergieId - Identifiant de l'allergie
 * @returns {Promise<boolean>} - true si liée à une ordonnance active
 */
async function isLinkedToActivePrescription(allergieId) {
  const allergie = await getById(allergieId);
  if (!allergie) return false;
  
  const patientId = allergie.patientId;
  
  // Interroger les ordonnances actives du patient
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
  
  const ordClient = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
  const ordDocClient = DynamoDBDocumentClient.from(ordClient);
  
  const ordonnancesParams = {
    TableName: "healthtrack-ordonnances",
    IndexName: "byPatientAndDate",
    KeyConditionExpression: "patientId = :patientId",
    FilterExpression: "statut = :statut",
    ExpressionAttributeValues: {
      ":patientId": patientId,
      ":statut": "ACTIVE"
    }
  };
  
  const ordonnancesResult = await ordDocClient.send(new QueryCommand(ordonnancesParams));
  
  // Pour chaque ordonnance active, vérifier les lignes de prescription
  for (const ordonnance of ordonnancesResult.Items || []) {
    const lignesParams = {
      TableName: "healthtrack-lignes-prescription",
      KeyConditionExpression: "ordonnanceId = :ordonnanceId",
      ExpressionAttributeValues: {
        ":ordonnanceId": ordonnance.ordonnanceId
      }
    };
    
    const lignesResult = await ordDocClient.send(new QueryCommand(lignesParams));
    
    for (const ligne of lignesResult.Items || []) {
      // Vérifier si le médicament correspond à l'allergie
      if (allergie.medicamentConcerne && ligne.medicamentId === allergie.medicamentConcerne) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Vérifie si un patient a une allergie à un médicament
 * @param {string} patientId - ID du patient
 * @param {string} medicamentId - ID du médicament
 * @returns {Promise<boolean>} - true si allergie trouvée
 */
async function hasAllergieToMedicament(patientId, medicamentId) {
  const allergies = await getByPatient(patientId);
  
  for (const allergie of allergies) {
    if (allergie.medicamentConcerne === medicamentId) {
      return true;
    }
  }
  
  return false;
}

module.exports = {
  ALLERGIE_SEVERITE,
  create,
  getById,
  getByPatient,
  update,
  deleteById,
  isLinkedToActivePrescription,
  hasAllergieToMedicament
};
