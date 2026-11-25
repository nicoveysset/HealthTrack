/**
 * AllergieService - Service pour accéder aux allergies
 * 
 * Ce service est une couche d'abstraction pour accéder aux allergies
 * depuis l'API Ordonnances. Il délègue au service de l'API Dossiers Médicaux.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-allergies";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Vérifie si un patient a une allergie à un médicament
 * @param {string} patientId - ID du patient
 * @param {string} medicamentId - ID du médicament
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<boolean>} - true si allergie trouvée
 */
async function hasAllergieToMedicament(patientId, medicamentId, currentUserId) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byPatient",
    KeyConditionExpression: "patientId = :patientId",
    ExpressionAttributeValues: {
      ":patientId": patientId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  
  for (const allergie of result.Items || []) {
    if (allergie.medicamentConcerne === medicamentId) {
      return true;
    }
  }
  
  return false;
}

/**
 * Récupère les allergies d'un patient
 * @param {string} patientId - ID du patient
 * @returns {Promise<Array>} - Liste des allergies
 */
async function getAllergiesByPatient(patientId) {
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

module.exports = {
  hasAllergieToMedicament,
  getAllergiesByPatient
};
