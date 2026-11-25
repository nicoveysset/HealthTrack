/**
 * OrdonnanceRepository - Couche d'accès aux données pour les ordonnances
 * 
 * Gère les interactions avec la table DynamoDB healthtrack-ordonnances.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-ordonnances";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

// Statuts des ordonnances
const ORDONNANCE_STATUT = {
  ACTIVE: 'ACTIVE',
  EXPIREE: 'EXPIREE'
};

/**
 * Crée une nouvelle ordonnance
 * @param {Object} ordonnance - Ordonnance à créer
 * @returns {Promise<Object>} - Ordonnance créée
 */
async function create(ordonnance) {
  const params = {
    TableName: TABLE_NAME,
    Item: ordonnance
  };
  
  await docClient.send(new PutCommand(params));
  return ordonnance;
}

/**
 * Récupère une ordonnance par son ID
 * @param {string} ordonnanceId - Identifiant de l'ordonnance
 * @returns {Promise<Object|null>} - Ordonnance trouvée ou null
 */
async function getById(ordonnanceId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { ordonnanceId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Attributes || result.Item || null;
}

/**
 * Récupère les ordonnances d'un patient
 * @param {string} patientId - ID du patient
 * @returns {Promise<Array>} - Liste des ordonnances
 */
async function getByPatient(patientId) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byPatientAndDate",
    KeyConditionExpression: "patientId = :patientId",
    ExpressionAttributeValues: {
      ":patientId": patientId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Récupère les ordonnances par statut
 * @param {string} statut - Statut (ACTIVE ou EXPIREE)
 * @returns {Promise<Array>} - Liste des ordonnances
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
 * Récupère les ordonnances par compte rendu
 * @param {string} compteRenduId - ID du compte rendu
 * @returns {Promise<Array>} - Liste des ordonnances
 */
async function getByCompteRendu(compteRenduId) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byCompteRendu",
    KeyConditionExpression: "compteRenduId = :compteRenduId",
    ExpressionAttributeValues: {
      ":compteRenduId": compteRenduId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Récupère les ordonnances par rendez-vous
 * @param {string} rdvId - ID du rendez-vous
 * @returns {Promise<Array>} - Liste des ordonnances
 */
async function getByRendezVous(rdvId) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byRendezVous",
    KeyConditionExpression: "rdvId = :rdvId",
    ExpressionAttributeValues: {
      ":rdvId": rdvId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Met à jour une ordonnance
 * @param {string} ordonnanceId - Identifiant de l'ordonnance
 * @param {Object} updates - Champs à mettre à jour
 * @returns {Promise<Object>} - Ordonnance mise à jour
 */
async function update(ordonnanceId, updates) {
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
    Key: { ordonnanceId },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW"
  };
  
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Supprime une ordonnance
 * @param {string} ordonnanceId - Identifiant de l'ordonnance
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteById(ordonnanceId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { ordonnanceId }
  };
  
  await docClient.send(new DeleteCommand(params));
  return { success: true };
}

/**
 * Vérifie l'expiration paresseuse et met à jour le statut si nécessaire
 * @param {Object} ordonnance - Ordonnance à vérifier
 * @returns {Promise<Object>} - Ordonnance avec statut mis à jour
 */
async function checkAndUpdateExpiration(ordonnance) {
  const now = new Date().toISOString();
  
  if (ordonnance.dateValidite && ordonnance.dateValidite < now && ordonnance.statut !== ORDONNANCE_STATUT.EXPIREE) {
    return await update(ordonnance.ordonnanceId, { statut: ORDONNANCE_STATUT.EXPIREE });
  }
  
  return ordonnance;
}

/**
 * Liste les ordonnances avec filtres optionnels
 * @param {Object} filters - Filtres (patientId, statut, praticienId, dateDebut, dateFin)
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} - Liste paginée des ordonnances
 */
async function list(filters = {}, page = 1, limit = 10) {
  const { patientId, statut, praticienId, dateDebut, dateFin } = filters;
  
  let params = {
    TableName: TABLE_NAME,
    Limit: limit
  };
  
  let indexName = null;
  let keyCondition = null;
  const expressionAttributeValues = {};
  
  if (patientId) {
    indexName = "byPatientAndDate";
    keyCondition = "patientId = :patientId";
    expressionAttributeValues[":patientId"] = patientId;
  } else if (statut) {
    indexName = "byStatut";
    keyCondition = "statut = :statut";
    expressionAttributeValues[":statut"] = statut;
  }
  
  if (indexName && keyCondition) {
    params.IndexName = indexName;
    params.KeyConditionExpression = keyCondition;
    params.ExpressionAttributeValues = expressionAttributeValues;
  }
  
  // Appliquer les filtres supplémentaires
  let filterExpression = "";
  if (praticienId) {
    filterExpression += (filterExpression ? " AND " : "") + "praticienId = :praticienId";
    expressionAttributeValues[":praticienId"] = praticienId;
  }
  
  if (dateDebut) {
    filterExpression += (filterExpression ? " AND " : "") + "dateEmission >= :dateDebut";
    expressionAttributeValues[":dateDebut"] = dateDebut;
  }
  
  if (dateFin) {
    filterExpression += (filterExpression ? " AND " : "") + "dateEmission <= :dateFin";
    expressionAttributeValues[":dateFin"] = dateFin;
  }
  
  if (filterExpression) {
    params.FilterExpression = filterExpression;
    params.ExpressionAttributeValues = expressionAttributeValues;
  }
  
  const result = await docClient.send(new ScanCommand(params));
  
  return {
    items: result.Items || [],
    count: result.Items ? result.Items.length : 0,
    page: parseInt(page),
    limit: parseInt(limit)
  };
}

module.exports = {
  ORDONNANCE_STATUT,
  create,
  getById,
  getByPatient,
  getByStatut,
  getByCompteRendu,
  getByRendezVous,
  update,
  deleteById,
  checkAndUpdateExpiration,
  list
};
