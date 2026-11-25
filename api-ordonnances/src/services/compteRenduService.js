/**
 * CompteRenduService - Service pour accéder aux comptes rendus
 * 
 * Ce service est une couche d'abstraction pour accéder aux comptes rendus
 * depuis l'API Ordonnances. Il délègue au service de l'API RDV.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-comptes-rendus";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Format d'erreur standard
 */
const formatError = (error, message, statusCode) => ({
  error,
  message,
  statusCode
});

/**
 * Récupère un compte rendu par son ID
 * @param {string} compteRenduId - ID du compte rendu
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Object|null>} - Compte rendu trouvé ou null
 */
async function getCompteRendu(compteRenduId, currentUserId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { compteRenduId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  const cr = result.Item || null;
  
  if (!cr) {
    throw formatError("NotFound", "Compte rendu non trouvé", 404);
  }
  
  // Vérifier l'accès
  if (cr.patientId !== currentUserId && cr.praticienId !== currentUserId) {
    throw formatError(
      "Forbidden",
      "Vous n'êtes pas autorisé à accéder à ce compte rendu",
      403
    );
  }
  
  return cr;
}

/**
 * Récupère un compte rendu par ID de rendez-vous
 * @param {string} rdvId - ID du rendez-vous
 * @returns {Promise<Object|null>} - Compte rendu trouvé ou null
 */
async function getCompteRenduByRdv(rdvId) {
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
 * Vérifie si un compte rendu existe
 * @param {string} compteRenduId - ID du compte rendu
 * @returns {Promise<boolean>} - true si le compte rendu existe
 */
async function existsCompteRendu(compteRenduId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { compteRenduId },
    ProjectionExpression: "compteRenduId"
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item !== null && result.Item !== undefined;
}

/**
 * Vérifie si un compte rendu a été finalisé
 * @param {string} compteRenduId - ID du compte rendu
 * @returns {Promise<boolean>} - true si le compte rendu est finalisé
 */
async function isCompteRenduFinalisé(compteRenduId) {
  const cr = await getCompteRendu(compteRenduId, null); // Pas de vérification d'accès ici
  return cr && cr.dateFinalisation !== null && cr.dateFinalisation !== undefined;
}

module.exports = {
  getCompteRendu,
  getCompteRenduByRdv,
  existsCompteRendu,
  isCompteRenduFinalisé
};
