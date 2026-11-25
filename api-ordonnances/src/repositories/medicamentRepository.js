/**
 * MedicamentRepository - Couche d'accès aux données pour les médicaments
 * 
 * Gère les interactions avec la table DynamoDB healthtrack-medicaments.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-medicaments";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

// Formes de médicaments
const MEDICAMENT_FORME = {
  COMPRIME: 'COMPRIME',
  SIROP: 'SIROP',
  INJECTION: 'INJECTION',
  AUTRE: 'AUTRE'
};

/**
 * Crée un nouveau médicament
 * @param {Object} medicament - Médicament à créer
 * @returns {Promise<Object>} - Médicament créé
 */
async function create(medicament) {
  const params = {
    TableName: TABLE_NAME,
    Item: medicament
  };
  
  await docClient.send(new PutCommand(params));
  return medicament;
}

/**
 * Récupère un médicament par son ID
 * @param {string} medicamentId - Identifiant du médicament
 * @returns {Promise<Object|null>} - Médicament trouvé ou null
 */
async function getById(medicamentId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { medicamentId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * Récupère les médicaments par substance active
 * @param {string} substanceActive - Substance active
 * @returns {Promise<Array>} - Liste des médicaments
 */
async function getBySubstanceActive(substanceActive) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "bySubstanceActive",
    KeyConditionExpression: "substanceActive = :substanceActive",
    ExpressionAttributeValues: {
      ":substanceActive": substanceActive
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Récupère les médicaments par forme
 * @param {string} forme - Forme du médicament
 * @returns {Promise<Array>} - Liste des médicaments
 */
async function getByForme(forme) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byForme",
    KeyConditionExpression: "forme = :forme",
    ExpressionAttributeValues: {
      ":forme": forme
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Met à jour un médicament
 * @param {string} medicamentId - Identifiant du médicament
 * @param {Object} updates - Champs à mettre à jour
 * @returns {Promise<Object>} - Médicament mis à jour
 */
async function update(medicamentId, updates) {
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
    Key: { medicamentId },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW"
  };
  
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Supprime un médicament
 * @param {string} medicamentId - Identifiant du médicament
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteById(medicamentId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { medicamentId }
  };
  
  await docClient.send(new DeleteCommand(params));
  return { success: true };
}

/**
 * Liste tous les médicaments (paginé)
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} - Liste paginée des médicaments
 */
async function list(page = 1, limit = 10) {
  const params = {
    TableName: TABLE_NAME,
    Limit: limit
  };
  
  const result = await docClient.send(new ScanCommand(params));
  
  return {
    items: result.Items || [],
    count: result.Items ? result.Items.length : 0,
    page: parseInt(page),
    limit: parseInt(limit)
  };
}

/**
 * Recherche des médicaments par nom
 * @param {string} nom - Nom ou partie du nom du médicament
 * @returns {Promise<Array>} - Liste des médicaments correspondants
 */
async function searchByNom(nom) {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "contains(nom, :nom)",
    ExpressionAttributeValues: {
      ":nom": nom
    }
  };
  
  const result = await docClient.send(new ScanCommand(params));
  return result.Items || [];
}

/**
 * Vérifie si un médicament existe
 * @param {string} nom - Nom du médicament
 * @returns {Promise<boolean>} - true si le médicament existe
 */
async function exists(nom) {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "nom = :nom",
    ExpressionAttributeValues: {
      ":nom": nom
    },
    Limit: 1
  };
  
  const result = await docClient.send(new ScanCommand(params));
  return result.Items && result.Items.length > 0;
}

module.exports = {
  MEDICAMENT_FORME,
  create,
  getById,
  getBySubstanceActive,
  getByForme,
  update,
  deleteById,
  list,
  searchByNom,
  exists
};
