/**
 * UserRepository - Couche d'accès aux données pour les utilisateurs
 * 
 * Ce repository gère toutes les interactions avec la table DynamoDB healthtrack-utilisateurs.
 * Il ne contient AUCUNE logique métier, uniquement des opérations CRUD.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

// Configuration DynamoDB
const TABLE_NAME = "healthtrack-utilisateurs";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Crée un nouvel utilisateur dans la table
 * @param {Object} user - Objet utilisateur à créer
 * @returns {Promise<Object>} - Utilisateur créé
 */
async function create(user) {
  const params = {
    TableName: TABLE_NAME,
    Item: user
  };
  
  await docClient.send(new PutCommand(params));
  return user;
}

/**
 * Récupère un utilisateur par son userId (clé primaire)
 * @param {string} userId - Identifiant unique de l'utilisateur
 * @returns {Promise<Object|null>} - Utilisateur trouvé ou null
 */
async function getById(userId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      userId
    }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * Récupère un utilisateur par son email (via GSI byEmail)
 * @param {string} email - Adresse email de l'utilisateur
 * @returns {Promise<Object|null>} - Utilisateur trouvé ou null
 */
async function getByEmail(email) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byEmail",
    KeyConditionExpression: "email = :email",
    ExpressionAttributeValues: {
      ":email": email
    },
    Limit: 1
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items ? result.Items[0] : null;
}

/**
 * Vérifie si un email existe déjà dans la table
 * @param {string} email - Adresse email à vérifier
 * @returns {Promise<boolean>} - true si l'email existe
 */
async function emailExists(email) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byEmail",
    KeyConditionExpression: "email = :email",
    ExpressionAttributeValues: {
      ":email": email
    },
    Limit: 1
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items && result.Items.length > 0;
}

/**
 * Met à jour un utilisateur par son userId
 * @param {string} userId - Identifiant unique de l'utilisateur
 * @param {Object} updates - Objet contenant les champs à mettre à jour
 * @returns {Promise<Object>} - Utilisateur mis à jour
 */
async function update(userId, updates) {
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
      userId
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
 * Supprime un utilisateur par son userId
 * @param {string} userId - Identifiant unique de l'utilisateur
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteById(userId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      userId
    }
  };
  
  return await docClient.send(new DeleteCommand(params));
}

/**
 * Liste les utilisateurs avec des filtres optionnels
 * @param {Object} filters - Filtres à appliquer (type, specialite, statut, etc.)
 * @param {number} page - Numéro de page (1-based)
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} - Objet contenant la liste paginée
 */
async function list(filters = {}, page = 1, limit = 10) {
  const { type, specialite, statut } = filters;
  
  let filterExpression = "";
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  if (type) {
    filterExpression += "#type = :type";
    expressionAttributeNames["#type"] = "type";
    expressionAttributeValues[":type"] = type;
  }
  
  if (specialite) {
    if (filterExpression) filterExpression += " AND ";
    filterExpression += "specialite = :specialite";
    expressionAttributeValues[":specialite"] = specialite;
  }
  
  if (statut) {
    if (filterExpression) filterExpression += " AND ";
    filterExpression += "statut = :statut";
    expressionAttributeValues[":statut"] = statut;
  }
  
  const params = {
    TableName: TABLE_NAME,
    Limit: limit
  };
  
  if (filterExpression) {
    params.FilterExpression = filterExpression;
    params.ExpressionAttributeNames = expressionAttributeNames;
    params.ExpressionAttributeValues = expressionAttributeValues;
  }
  
  // Note: Scan est utilisé ici car il n'y a pas de GSI adapté pour ces filtres combinés
  // Pour une meilleure performance, considérer la création d'un GSI supplémentaire
  const result = await docClient.send(new ScanCommand(params));
  
  return {
    items: result.Items || [],
    count: result.Items ? result.Items.length : 0,
    page,
    limit
  };
}

/**
 * Liste les patients par médecin traitant (via GSI byMedecinTraitant)
 * @param {string} medecinTraitantId - ID du médecin traitant
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} - Objet contenant la liste paginée
 */
async function listPatientsByMedecinTraitant(medecinTraitantId, page = 1, limit = 10) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byMedecinTraitant",
    KeyConditionExpression: "medecinTraitantId = :medecinTraitantId",
    ExpressionAttributeValues: {
      ":medecinTraitantId": medecinTraitantId
    },
    Limit: limit
  };
  
  const result = await docClient.send(new QueryCommand(params));
  
  return {
    items: result.Items || [],
    count: result.Items ? result.Items.length : 0,
    page,
    limit
  };
}

/**
 * Liste les praticiens (via scan avec filtre sur type)
 * @param {Object} filters - Filtres (specialite, statut)
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} - Objet contenant la liste paginée
 */
async function listPraticiens(filters = {}, page = 1, limit = 10) {
  const { specialite, statut } = filters;
  
  let filterExpression = "#type = :type";
  const expressionAttributeNames = {
    "#type": "type"
  };
  const expressionAttributeValues = {
    ":type": "PRATICIEN"
  };
  
  if (specialite) {
    filterExpression += " AND specialite = :specialite";
    expressionAttributeValues[":specialite"] = specialite;
  }
  
  if (statut) {
    filterExpression += " AND statut = :statut";
    expressionAttributeValues[":statut"] = statut;
  }
  
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: filterExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    Limit: limit
  };
  
  const result = await docClient.send(new ScanCommand(params));
  
  return {
    items: result.Items || [],
    count: result.Items ? result.Items.length : 0,
    page,
    limit
  };
}

/**
 * Compte le nombre d'utilisateurs correspondant à des critères
 * @param {Object} filters - Filtres à appliquer
 * @returns {Promise<number>} - Nombre d'utilisateurs
 */
async function count(filters = {}) {
  const { type, specialite, statut } = filters;
  
  let filterExpression = "";
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  if (type) {
    filterExpression += "#type = :type";
    expressionAttributeNames["#type"] = "type";
    expressionAttributeValues[":type"] = type;
  }
  
  if (specialite) {
    if (filterExpression) filterExpression += " AND ";
    filterExpression += "specialite = :specialite";
    expressionAttributeValues[":specialite"] = specialite;
  }
  
  if (statut) {
    if (filterExpression) filterExpression += " AND ";
    filterExpression += "statut = :statut";
    expressionAttributeValues[":statut"] = statut;
  }
  
  const params = {
    TableName: TABLE_NAME,
    Select: "COUNT",
  };
  
  if (filterExpression) {
    params.FilterExpression = filterExpression;
    params.ExpressionAttributeNames = expressionAttributeNames;
    params.ExpressionAttributeValues = expressionAttributeValues;
  }
  
  const result = await docClient.send(new ScanCommand(params));
  return result.Count || 0;
}

module.exports = {
  create,
  getById,
  getByEmail,
  emailExists,
  update,
  deleteById,
  list,
  listPatientsByMedecinTraitant,
  listPraticiens,
  count
};
