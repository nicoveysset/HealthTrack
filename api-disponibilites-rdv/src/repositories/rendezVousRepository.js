/**
 * RendezVousRepository - Couche d'accès aux données pour les rendez-vous
 * 
 * Gère les interactions avec la table DynamoDB healthtrack-rendezvous.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "healthtrack-rendezvous";
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

// Statuts des RDV
const RDV_STATUT = {
  PLANIFIE: 'PLANIFIE',
  CONFIRME: 'CONFIRME',
  EN_COURS: 'EN_COURS',
  TERMINE: 'TERMINE',
  ANNULE: 'ANNULE',
  NON_VENU: 'NON_VENU'
};

/**
 * Crée un nouveau rendez-vous
 * @param {Object} rdv - Rendez-vous à créer
 * @returns {Promise<Object>} - Rendez-vous créé
 */
async function create(rdv) {
  const params = {
    TableName: TABLE_NAME,
    Item: rdv
  };
  
  await docClient.send(new PutCommand(params));
  return rdv;
}

/**
 * Récupère un rendez-vous par son ID
 * @param {string} rdvId - Identifiant du rendez-vous
 * @returns {Promise<Object|null>} - Rendez-vous trouvé ou null
 */
async function getById(rdvId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { rdvId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * Récupère les rendez-vous d'un praticien pour une date
 * @param {string} praticienId - ID du praticien
 * @param {string} date - Date (format YYYY-MM-DD)
 * @returns {Promise<Array>} - Liste des rendez-vous
 */
async function getByPraticienAndDate(praticienId, date) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byPraticienAndDate",
    KeyConditionExpression: "praticienId = :praticienId AND #date = :date",
    ExpressionAttributeNames: {
      "#date": "date"
    },
    ExpressionAttributeValues: {
      ":praticienId": praticienId,
      ":date": date
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Récupère les rendez-vous d'un patient pour une date
 * @param {string} patientId - ID du patient
 * @param {string} date - Date (format YYYY-MM-DD)
 * @returns {Promise<Array>} - Liste des rendez-vous
 */
async function getByPatientAndDate(patientId, date) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byPatientAndDate",
    KeyConditionExpression: "patientId = :patientId AND #date = :date",
    ExpressionAttributeNames: {
      "#date": "date"
    },
    ExpressionAttributeValues: {
      ":patientId": patientId,
      ":date": date
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Récupère les rendez-vous par statut
 * @param {string} statut - Statut du rendez-vous
 * @returns {Promise<Array>} - Liste des rendez-vous
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
 * Met à jour un rendez-vous
 * @param {string} rdvId - Identifiant du rendez-vous
 * @param {Object} updates - Champs à mettre à jour
 * @returns {Promise<Object>} - Rendez-vous mis à jour
 */
async function update(rdvId, updates) {
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
    Key: { rdvId },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW"
  };
  
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Supprime un rendez-vous
 * @param {string} rdvId - Identifiant du rendez-vous
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteById(rdvId) {
  const params = {
    TableName: TABLE_NAME,
    Key: { rdvId }
  };
  
  await docClient.send(new DeleteCommand(params));
  return { success: true };
}

/**
 * Liste les rendez-vous avec filtres optionnels
 * @param {Object} filters - Filtres (praticienId, patientId, statut, dateDebut, dateFin)
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} - Liste paginée des rendez-vous
 */
async function list(filters = {}, page = 1, limit = 10) {
  const { statut, dateDebut, dateFin, patientId, praticienId } = filters;
  
  let filterExpression = "";
  const expressionAttributeValues = {};
  
  if (statut) {
    filterExpression += (filterExpression ? " AND " : "") + "statut = :statut";
    expressionAttributeValues[":statut"] = statut;
  }
  
  if (patientId) {
    filterExpression += (filterExpression ? " AND " : "") + "patientId = :patientId";
    expressionAttributeValues[":patientId"] = patientId;
  }
  
  if (praticienId) {
    filterExpression += (filterExpression ? " AND " : "") + "praticienId = :praticienId";
    expressionAttributeValues[":praticienId"] = praticienId;
  }
  
  if (dateDebut) {
    filterExpression += (filterExpression ? " AND " : "") + "#date >= :dateDebut";
    expressionAttributeValues[":dateDebut"] = dateDebut;
  }
  
  if (dateFin) {
    filterExpression += (filterExpression ? " AND " : "") + "#date <= :dateFin";
    expressionAttributeValues[":dateFin"] = dateFin;
  }
  
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: filterExpression || null,
    ExpressionAttributeNames: filterExpression.includes("#date") ? { "#date": "date" } : null,
    ExpressionAttributeValues: expressionAttributeValues,
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
 * Vérifie si un créneau est déjà pris par un rendez-vous
 * @param {string} praticienId - ID du praticien
 * @param {string} date - Date (format YYYY-MM-DD)
 * @param {string} heure - Heure (format HH:MM)
 * @param {number} duree - Durée en minutes
 * @param {string|null} excludedRdvId - ID du RDV à exclure (pour les mises à jour)
 * @returns {Promise<boolean>} - true si le créneau est pris
 */
async function isCreneauPris(praticienId, date, heure, duree, excludedRdvId = null) {
  const rdvs = await getByPraticienAndDate(praticienId, date);
  
  const creneauDebut = new Date(date + 'T' + heure);
  const creneauFin = new Date(creneauDebut.getTime() + duree * 60000);
  
  for (const rdv of rdvs) {
    if (excludedRdvId && rdv.rdvId === excludedRdvId) {
      continue;
    }
    
    const rdvDate = new Date(rdv.date + 'T' + rdv.heure);
    const rdvFin = new Date(rdvDate.getTime() + rdv.duree * 60000);
    
    // Vérifier le chevauchement
    if (creneauDebut < rdvFin && creneauFin > rdvDate) {
      return true;
    }
  }
  
  return false;
}

/**
 * Vérifie si un patient a un rendez-vous à une date/heure
 * @param {string} patientId - ID du patient
 * @param {string} date - Date (format YYYY-MM-DD)
 * @param {string} heure - Heure (format HH:MM)
 * @returns {Promise<boolean>} - true si le patient a un RDV à ce créneau
 */
async function patientHasRendezVous(patientId, date, heure) {
  const rdvs = await getByPatientAndDate(patientId, date);
  
  for (const rdv of rdvs) {
    if (rdv.heure === heure) {
      return true;
    }
  }
  
  return false;
}

/**
 * Vérifie si un praticien a eu un RDV TERMINE avec un patient
 * @param {string} praticienId - ID du praticien
 * @param {string} patientId - ID du patient
 * @returns {Promise<boolean>} - true si accès autorisé
 */
async function hasAccessToPatient(praticienId, patientId) {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "praticienId = :praticienId AND patientId = :patientId AND statut = :statut",
    ExpressionAttributeValues: {
      ":praticienId": praticienId,
      ":patientId": patientId,
      ":statut": RDV_STATUT.TERMINE
    },
    Limit: 1
  };
  
  const result = await docClient.send(new ScanCommand(params));
  return result.Items && result.Items.length > 0;
}

module.exports = {
  RDV_STATUT,
  create,
  getById,
  getByPraticienAndDate,
  getByPatientAndDate,
  getByStatut,
  update,
  deleteById,
  list,
  isCreneauPris,
  patientHasRendezVous,
  hasAccessToPatient
};
