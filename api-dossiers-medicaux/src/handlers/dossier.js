/**
 * HealthTrack API - Dossiers Médicaux
 * Handler principal pour toutes les routes
 * 
 * Routes gérées :
 * Dossier:
 * - GET /patients/{patientId}/dossier - Récupérer le dossier complet
 * 
 * Antecedents:
 * - POST /dossiers/{id}/antecedents - Créer un antécédent
 * - PATCH /antecedents/{id} - Mettre à jour un antécédent
 * - POST /antecedents/{id}/archiver - Archiver un antécédent
 * - GET /patients/{id}/antecedents - Lister les antécédents d'un patient
 * 
 * Allergies:
 * - POST /dossiers/{id}/allergies - Créer une allergie
 * - DELETE /allergies/{id} - Supprimer une allergie
 * - GET /patients/{id}/allergies - Lister les allergies d'un patient
 * 
 * Vaccinations:
 * - POST /dossiers/{id}/vaccinations - Créer une vaccination
 * - GET /patients/{id}/vaccinations - Lister les vaccinations d'un patient
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { CloudWatchLogsClient, PutLogEventsCommand } = require("@aws-sdk/client-cloudwatch-logs");
const { v4: uuidv4 } = require("uuid");

// Initialiser DynamoDB
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

// Initialiser CloudWatch Logs
const cwLogsClient = new CloudWatchLogsClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });

// Noms des tables
const TABLES = {
  utilisateurs: "healthtrack-utilisateurs",
  dossiers: "healthtrack-dossiers-medicaux",
  antecedents: "healthtrack-antecedents",
  allergies: "healthtrack-allergies",
  vaccinations: "healthtrack-vaccinations",
  rendezvous: "healthtrack-rendezvous",
  ordonnances: "healthtrack-ordonnances"
};

// Types d'antécédents
const ANTECEDENT_TYPE = {
  CHRONIQUE: 'CHRONIQUE',
  PONCTUEL: 'PONCTUEL'
};

// Statuts d'antécédents
const ANTECEDENT_STATUT = {
  ACTIF: 'ACTIF',
  ARCHIVE: 'ARCHIVE'
};

// Séverités d'allergies
const ALLERGIE_SEVERITE = {
  LEGERE: 'LEGERE',
  MODEREE: 'MODEREE',
  SEVERE: 'SEVERE'
};

// Format d'erreur standard
const formatError = (error, message, statusCode) => ({
  error,
  message,
  statusCode
});

/**
 * Log dans CloudWatch
 */
const logToCloudWatch = async (message, details = {}) => {
  try {
    const logGroupName = '/aws/lambda/healthtrack-api-dossiers';
    const logStreamName = new Date().toISOString().split('T')[0];
    
    // Créer le log group si nécessaire
    // Créer le log stream si nécessaire
    
    // Pour simplifier, on utilise console.log qui est automatiquement envoyé à CloudWatch
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      message,
      details
    }));
  } catch (error) {
    console.error("Erreur lors du log CloudWatch :", error);
  }
};

/**
 * Récupère un utilisateur par ID
 */
const getUserById = async (userId) => {
  const params = {
    TableName: TABLES.utilisateurs,
    Key: { userId }
  };
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
};

/**
 * Vérifie si le praticien a déjà consulté le patient
 */
const hasPraticienConsultedPatient = async (praticienId, patientId) => {
  const params = {
    TableName: TABLES.rendezvous,
    FilterExpression: "praticienId = :praticienId AND patientId = :patientId AND statut = :statut",
    ExpressionAttributeValues: {
      ":praticienId": praticienId,
      ":patientId": patientId,
      ":statut": "TERMINE"
    },
    Limit: 1
  };
  
  const result = await docClient.send(new ScanCommand(params));
  return result.Items && result.Items.length > 0;
};

/**
 * Vérifie si une allergie est liée à une ordonnance active
 */
const isAllergieLinkedToActivePrescription = async (allergieId) => {
  // 1. Récupérer l'allergie
  const allergie = await getAllergieById(allergieId);
  if (!allergie) return false;
  
  // 2. Récupérer le patient
  const patientId = allergie.patientId; // À adapter selon le schéma
  
  // 3. Récupérer toutes les ordonnances ACTIVE du patient
  const params = {
    TableName: TABLES.ordonnances,
    IndexName: "byPatientAndDate",
    KeyConditionExpression: "patientId = :patientId",
    FilterExpression: "statut = :statut",
    ExpressionAttributeValues: {
      ":patientId": patientId,
      ":statut": "ACTIVE"
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  
  // 4. Pour chaque ordonnance, vérifier si elle contient un médicament lié à l'allergie
  for (const ordonnance of result.Items || []) {
    // Récupérer les lignes de prescription
    const lignesParams = {
      TableName: TABLES.lignesPrescription,
      KeyConditionExpression: "ordonnanceId = :ordonnanceId",
      ExpressionAttributeValues: {
        ":ordonnanceId": ordonnance.ordonnanceId
      }
    };
    
    const lignesResult = await docClient.send(new QueryCommand(lignesParams));
    
    for (const ligne of lignesResult.Items || []) {
      // Vérifier si le médicament de la ligne correspond à l'allergie
      // (À implémenter : comparaison entre médicament et allergie)
      // Pour simplifier, on suppose qu'on a un champ medicamentId dans ligne
      // et un champ medicamentConcerne dans allergie
      if (ligne.medicamentId && allergie.medicamentConcerne && ligne.medicamentId === allergie.medicamentConcerne) {
        return true;
      }
    }
  }
  
  return false;
};

// =============================================================================
// Dossier Médical
// =============================================================================

/**
 * Récupère un dossier médical
 */
const getDossierMedical = async (patientId) => {
  const params = {
    TableName: TABLES.dossiers,
    Key: { patientId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
};

/**
 * Crée un dossier médical (appelé automatiquement à la création d'un patient)
 */
const createDossierMedical = async (patientId, data = {}) => {
  const now = new Date().toISOString();
  
  const dossier = {
    patientId,
    groupeSanguin: data.groupeSanguin || '',
    dateCreation: now,
    updatedAt: now
  };
  
  const params = {
    TableName: TABLES.dossiers,
    Item: dossier
  };
  
  await docClient.send(new PutCommand(params));
  return dossier;
};

// =============================================================================
// Antecedents
// =============================================================================

/**
 * Récupère un antécédent par ID
 */
const getAntecedentById = async (antecedentId) => {
  const params = {
    TableName: TABLES.antecedents,
    Key: { antecedentId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
};

/**
 * Crée un antécédent
 */
const createAntecedent = async (antecedentData) => {
  const antecedentId = uuidv4();
  const now = new Date().toISOString();
  
  const antecedent = {
    antecedentId,
    dossierId: antecedentData.dossierId,
    libellé: antecedentData.libellé,
    type: antecedentData.type || ANTECEDENT_TYPE.PONCTUEL,
    date: antecedentData.date || now,
    statut: ANTECEDENT_STATUT.ACTIF,
    description: antecedentData.description || '',
    createdAt: now,
    updatedAt: now
  };
  
  const params = {
    TableName: TABLES.antecedents,
    Item: antecedent
  };
  
  await docClient.send(new PutCommand(params));
  return antecedent;
};

/**
 * Met à jour un antécédent
 */
const updateAntecedent = async (antecedentId, updates) => {
  const now = new Date().toISOString();
  updates.updatedAt = now;
  
  const updateExpressionParts = [];
  const expressionAttributeValues = {};
  
  for (const [key, value] of Object.entries(updates)) {
    updateExpressionParts.push(`${key} = :${key}`);
    expressionAttributeValues[`:${key}`] = value;
  }
  
  const params = {
    TableName: TABLES.antecedents,
    Key: { antecedentId },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW"
  };
  
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
};

/**
 * Archive un antécédent
 */
const archiveAntecedent = async (antecedentId) => {
  const antecedent = await getAntecedentById(antecedentId);
  
  if (!antecedent) {
    throw new Error("Antécédent non trouvé");
  }
  
  // Vérifier que l'antécédent n'est pas déjà archivé
  if (antecedent.statut === ANTECEDENT_STATUT.ARCHIVE) {
    throw new Error("Antécédent déjà archivé");
  }
  
  // Vérifier que l'antécédent n'est pas CHRONIQUE
  if (antecedent.type === ANTECEDENT_TYPE.CHRONIQUE) {
    throw new Error("Les antécédents chroniques ne peuvent pas être archivés");
  }
  
  return await updateAntecedent(antecedentId, {
    statut: ANTECEDENT_STATUT.ARCHIVE
  });
};

/**
 * Liste les antécédents d'un patient
 */
const listAntecedentsByPatient = async (patientId) => {
  // Récupérer le dossier du patient
  const dossier = await getDossierMedical(patientId);
  if (!dossier) return [];
  
  const params = {
    TableName: TABLES.antecedents,
    IndexName: "byDossier",
    KeyConditionExpression: "dossierId = :dossierId",
    ExpressionAttributeValues: {
      ":dossierId": dossier.patientId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
};

// =============================================================================
// Allergies
// =============================================================================

/**
 * Récupère une allergie par ID
 */
const getAllergieById = async (allergieId) => {
  const params = {
    TableName: TABLES.allergies,
    Key: { allergieId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
};

/**
 * Crée une allergie
 */
const createAllergie = async (allergieData) => {
  const allergieId = uuidv4();
  const now = new Date().toISOString();
  
  const allergie = {
    allergieId,
    patientId: allergieData.patientId,
    médicamentConcerne: allergieData.médicamentConcerne,
    sévérité: allergieData.sévérité || ALLERGIE_SEVERITE.MODEREE,
    dateDécouverte: allergieData.dateDécouverte || now,
    description: allergieData.description || '',
    createdAt: now,
    updatedAt: now
  };
  
  const params = {
    TableName: TABLES.allergies,
    Item: allergie
  };
  
  await docClient.send(new PutCommand(params));
  
  // Log CloudWatch : modification d'allergie
  await logToCloudWatch('Nouvelle allergie créée', {
    allergieId,
    patientId: allergie.patientId,
    médicamentConcerne: allergie.médicamentConcerne,
    sévérité: allergie.sévérité,
    action: 'CREATE'
  });
  
  return allergie;
};

/**
 * Supprime une allergie
 */
const deleteAllergie = async (allergieId) => {
  // Vérifier que l'allergie n'est pas liée à une ordonnance active
  const isLinked = await isAllergieLinkedToActivePrescription(allergieId);
  
  if (isLinked) {
    throw new Error("AllergyLinkedToActivePrescriptionException");
  }
  
  const params = {
    TableName: TABLES.allergies,
    Key: { allergieId }
  };
  
  await docClient.send(new DeleteCommand(params));
  
  // Log CloudWatch : suppression d'allergie
  await logToCloudWatch('Allergie supprimée', {
    allergieId,
    action: 'DELETE'
  });
  
  return { success: true };
};

/**
 * Liste les allergies d'un patient
 */
const listAllergiesByPatient = async (patientId) => {
  const params = {
    TableName: TABLES.allergies,
    IndexName: "byPatient",
    KeyConditionExpression: "patientId = :patientId",
    ExpressionAttributeValues: {
      ":patientId": patientId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
};

// =============================================================================
// Vaccinations
// =============================================================================

/**
 * Récupère une vaccination par ID
 */
const getVaccinationById = async (vaccinationId) => {
  const params = {
    TableName: TABLES.vaccinations,
    Key: { vaccinationId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
};

/**
 * Crée une vaccination
 */
const createVaccination = async (vaccinationData) => {
  const vaccinationId = uuidv4();
  const now = new Date().toISOString();
  
  const vaccination = {
    vaccinationId,
    dossierId: vaccinationData.dossierId,
    nomVaccin: vaccinationData.nomVaccin,
    date: vaccinationData.date || now,
    rappelPrévu: vaccinationData.rappelPrévu || '',
    description: vaccinationData.description || '',
    createdAt: now,
    updatedAt: now
  };
  
  const params = {
    TableName: TABLES.vaccinations,
    Item: vaccination
  };
  
  await docClient.send(new PutCommand(params));
  return vaccination;
};

/**
 * Liste les vaccinations d'un patient
 */
const listVaccinationsByPatient = async (patientId) => {
  // Récupérer le dossier du patient
  const dossier = await getDossierMedical(patientId);
  if (!dossier) return [];
  
  const params = {
    TableName: TABLES.vaccinations,
    IndexName: "byDossier",
    KeyConditionExpression: "dossierId = :dossierId",
    ExpressionAttributeValues: {
      ":dossierId": dossier.patientId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
};

// =============================================================================
// Handler principal
// =============================================================================

exports.handler = async (event, context) => {
  try {
    console.log("Event:", JSON.stringify(event, null, 2));
    
    // Parser la requête
    const { httpMethod, path, headers, queryStringParameters, body } = event;
    const requestPath = path || event.requestContext?.path;
    const requestBody = body ? JSON.parse(body) : {};
    
    // Extraire le userId du token JWT (si présent)
    let currentUser = null;
    if (headers?.Authorization || headers?.authorization) {
      const authHeader = headers.Authorization || headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          currentUser = jwt.verify(token, process.env.JWT_SECRET);
          console.log("Utilisateur authentifié :", currentUser);
        } catch (jwtError) {
          console.log("Token JWT invalide :", jwtError.message);
        }
      }
    }
    
    if (!currentUser) {
      return {
        statusCode: 401,
        body: JSON.stringify(formatError("Unauthorized", "Non autorisé", 401))
      };
    }
    
    // Router les requêtes
    // Normaliser le path : remplacer les IDs réels par les placeholders
    const routePath = requestPath
      .replace(/\/patients\/[^/]+\/dossier/, '/patients/{patientId}/dossier')
      .replace(/\/patients\/[^/]+\/antecedents/, '/patients/{patientId}/antecedents')
      .replace(/\/patients\/[^/]+\/allergies/, '/patients/{patientId}/allergies')
      .replace(/\/patients\/[^/]+\/vaccinations/, '/patients/{patientId}/vaccinations')
      .replace(/\/dossiers\/[^/]+\/antecedents/, '/dossiers/{dossierId}/antecedents')
      .replace(/\/dossiers\/[^/]+\/allergies/, '/dossiers/{dossierId}/allergies')
      .replace(/\/dossiers\/[^/]+\/vaccinations/, '/dossiers/{dossierId}/vaccinations')
      .replace(/\/antecedents\/[^/]+\/archiver/, '/antecedents/{antecedentId}/archiver')
      .replace(/\/antecedents\/[^/]+/, '/antecedents/{antecedentId}')
      .replace(/\/allergies\/[^/]+/, '/allergies/{allergieId}');
    
    switch (`${httpMethod} ${routePath}`) {
      // ========================================================================
      // Dossier Médical
      // ========================================================================
      
      case "GET /patients/{patientId}/dossier": {
        const patientId = requestPath.split('/')[2];
        
        // Vérifier que l'utilisateur est soit le patient soit un praticien qui l'a déjà consulté
        if (currentUser.sub !== patientId && currentUser.type === 'PRATICIEN') {
          const hasConsulted = await hasPraticienConsultedPatient(currentUser.sub, patientId);
          if (!hasConsulted) {
            return {
              statusCode: 403,
              body: JSON.stringify(formatError("AccessDeniedException", "Vous n'avez pas consulté ce patient", 403))
            };
          }
        }
        
        // Récupérer le dossier
        let dossier = await getDossierMedical(patientId);
        
        // Si le dossier n'existe pas, le créer
        if (!dossier && currentUser.sub === patientId) {
          dossier = await createDossierMedical(patientId);
        }
        
        if (!dossier) {
          return {
            statusCode: 404,
            body: JSON.stringify(formatError("NotFound", "Dossier non trouvé", 404))
          };
        }
        
        // Récupérer les antécédents
        const antecedents = await listAntecedentsByPatient(patientId);
        
        // Récupérer les allergies
        const allergies = await listAllergiesByPatient(patientId);
        
        // Récupérer les vaccinations
        const vaccinations = await listVaccinationsByPatient(patientId);
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            dossier,
            antecedents,
            allergies,
            vaccinations
          })
        };
      }
      
      // ========================================================================
      // Antecedents
      // ========================================================================
      
      case "POST /dossiers/{dossierId}/antecedents": {
        const dossierIdFromPath = requestPath.split('/')[2];
        
        // Vérifier que le dossier appartient au patient
        const patientDossier = await getDossierMedical(dossierIdFromPath);
        if (!patientDossier) {
          return {
            statusCode: 404,
            body: JSON.stringify(formatError("NotFound", "Dossier non trouvé", 404))
          };
        }
        
        // Vérifier les permissions
        if (currentUser.sub !== patientDossier.patientId && currentUser.type === 'PRATICIEN') {
          const hasConsulted = await hasPraticienConsultedPatient(currentUser.sub, patientDossier.patientId);
          if (!hasConsulted) {
            return {
              statusCode: 403,
              body: JSON.stringify(formatError("AccessDeniedException", "Vous n'avez pas consulté ce patient", 403))
            };
          }
        }
        
        const antecedent = await createAntecedent({
          ...requestBody,
          dossierId: patientDossier.patientId
        });
        
        return {
          statusCode: 201,
          body: JSON.stringify(antecedent)
        };
      }
      
      case "PATCH /antecedents/{antecedentId}": {
        const antecedentId = requestPath.split('/')[2];
        
        const antecedent = await getAntecedentById(antecedentId);
        if (!antecedent) {
          return {
            statusCode: 404,
            body: JSON.stringify(formatError("NotFound", "Antécédent non trouvé", 404))
          };
        }
        
        // Vérifier les permissions
        if (currentUser.sub !== antecedent.dossierId && currentUser.type === 'PRATICIEN') {
          const hasConsulted = await hasPraticienConsultedPatient(currentUser.sub, antecedent.dossierId);
          if (!hasConsulted) {
            return {
              statusCode: 403,
              body: JSON.stringify(formatError("AccessDeniedException", "Vous n'avez pas consulté ce patient", 403))
            };
          }
        }
        
        // Empêcher la modification du type et du statut via PATCH
        const updates = { ...requestBody };
        delete updates.antecedentId;
        delete updates.dossierId;
        delete updates.type;
        delete updates.statut;
        
        const updatedAntecedent = await updateAntecedent(antecedentId, updates);
        
        return {
          statusCode: 200,
          body: JSON.stringify(updatedAntecedent)
        };
      }
      
      case "POST /antecedents/{antecedentId}/archiver": {
        const antecedentIdForArchive = requestPath.split('/')[2];
        
        try {
          const antecedent = await archiveAntecedent(antecedentIdForArchive);
          return {
            statusCode: 200,
            body: JSON.stringify(antecedent)
          };
        } catch (error) {
          if (error.message === "Antécédent non trouvé") {
            return {
              statusCode: 404,
              body: JSON.stringify(formatError("NotFound", "Antécédent non trouvé", 404))
            };
          }
          if (error.message === "Antécédent déjà archivé") {
            return {
              statusCode: 409,
              body: JSON.stringify(formatError("Conflict", "Antécédent déjà archivé", 409))
            };
          }
          if (error.message === "Les antécédents chroniques ne peuvent pas être archivés") {
            return {
              statusCode: 409,
              body: JSON.stringify(formatError("ChronicConditionCannotBeArchivedException", "Les antécédents chroniques ne peuvent pas être archivés", 409))
            };
          }
          throw error;
        }
      }
      
      case "GET /patients/{patientId}/antecedents": {
        const patientIdForAntecedents = requestPath.split('/')[2];
        
        // Vérifier les permissions
        if (currentUser.sub !== patientIdForAntecedents && currentUser.type === 'PRATICIEN') {
          const hasConsulted = await hasPraticienConsultedPatient(currentUser.sub, patientIdForAntecedents);
          if (!hasConsulted) {
            return {
              statusCode: 403,
              body: JSON.stringify(formatError("AccessDeniedException", "Vous n'avez pas consulté ce patient", 403))
            };
          }
        }
        
        const antecedents = await listAntecedentsByPatient(patientIdForAntecedents);
        
        return {
          statusCode: 200,
          body: JSON.stringify(antecedents)
        };
      }
      
      // ========================================================================
      // Allergies
      // ========================================================================
      
      case "POST /dossiers/{dossierId}/allergies": {
        const dossierIdForAllergie = requestPath.split('/')[2];
        
        // Vérifier que le dossier appartient au patient
        const dossierForAllergie = await getDossierMedical(dossierIdForAllergie);
        if (!dossierForAllergie) {
          return {
            statusCode: 404,
            body: JSON.stringify(formatError("NotFound", "Dossier non trouvé", 404))
          };
        }
        
        // Vérifier les permissions
        if (currentUser.sub !== dossierForAllergie.patientId && currentUser.type === 'PRATICIEN') {
          const hasConsulted = await hasPraticienConsultedPatient(currentUser.sub, dossierForAllergie.patientId);
          if (!hasConsulted) {
            return {
              statusCode: 403,
              body: JSON.stringify(formatError("AccessDeniedException", "Vous n'avez pas consulté ce patient", 403))
            };
          }
        }
        
        const allergie = await createAllergie({
          ...requestBody,
          patientId: dossierForAllergie.patientId
        });
        
        return {
          statusCode: 201,
          body: JSON.stringify(allergie)
        };
      }
      
      case "DELETE /allergies/{allergieId}": {
        const allergieId = requestPath.split('/')[2];
        
        const allergie = await getAllergieById(allergieId);
        if (!allergie) {
          return {
            statusCode: 404,
            body: JSON.stringify(formatError("NotFound", "Allergie non trouvée", 404))
          };
        }
        
        // Vérifier les permissions
        if (currentUser.sub !== allergie.patientId && currentUser.type === 'PRATICIEN') {
          const hasConsulted = await hasPraticienConsultedPatient(currentUser.sub, allergie.patientId);
          if (!hasConsulted) {
            return {
              statusCode: 403,
              body: JSON.stringify(formatError("AccessDeniedException", "Vous n'avez pas consulté ce patient", 403))
            };
          }
        }
        
        try {
          await deleteAllergie(allergieId);
          return {
            statusCode: 204,
            body: JSON.stringify({})
          };
        } catch (error) {
          if (error.message === "AllergyLinkedToActivePrescriptionException") {
            return {
              statusCode: 409,
              body: JSON.stringify(formatError("AllergyLinkedToActivePrescriptionException", "Cette allergie est liée à une ordonnance active", 409))
            };
          }
          throw error;
        }
      }
      
      case "GET /patients/{patientId}/allergies": {
        const patientIdForAllergies = requestPath.split('/')[2];
        
        // Vérifier les permissions
        if (currentUser.sub !== patientIdForAllergies && currentUser.type === 'PRATICIEN') {
          const hasConsulted = await hasPraticienConsultedPatient(currentUser.sub, patientIdForAllergies);
          if (!hasConsulted) {
            return {
              statusCode: 403,
              body: JSON.stringify(formatError("AccessDeniedException", "Vous n'avez pas consulté ce patient", 403))
            };
          }
        }
        
        const allergies = await listAllergiesByPatient(patientIdForAllergies);
        
        return {
          statusCode: 200,
          body: JSON.stringify(allergies)
        };
      }
      
      // ========================================================================
      // Vaccinations
      // ========================================================================
      
      case "POST /dossiers/{dossierId}/vaccinations": {
        const dossierIdForVaccination = requestPath.split('/')[2];
        
        // Vérifier que le dossier appartient au patient
        const dossierForVaccination = await getDossierMedical(dossierIdForVaccination);
        if (!dossierForVaccination) {
          return {
            statusCode: 404,
            body: JSON.stringify(formatError("NotFound", "Dossier non trouvé", 404))
          };
        }
        
        // Vérifier les permissions
        if (currentUser.sub !== dossierForVaccination.patientId && currentUser.type === 'PRATICIEN') {
          const hasConsulted = await hasPraticienConsultedPatient(currentUser.sub, dossierForVaccination.patientId);
          if (!hasConsulted) {
            return {
              statusCode: 403,
              body: JSON.stringify(formatError("AccessDeniedException", "Vous n'avez pas consulté ce patient", 403))
            };
          }
        }
        
        const vaccination = await createVaccination({
          ...requestBody,
          dossierId: dossierForVaccination.patientId
        });
        
        return {
          statusCode: 201,
          body: JSON.stringify(vaccination)
        };
      }
      
      case "GET /patients/{patientId}/vaccinations": {
        const patientIdForVaccinations = requestPath.split('/')[2];
        
        // Vérifier les permissions
        if (currentUser.sub !== patientIdForVaccinations && currentUser.type === 'PRATICIEN') {
          const hasConsulted = await hasPraticienConsultedPatient(currentUser.sub, patientIdForVaccinations);
          if (!hasConsulted) {
            return {
              statusCode: 403,
              body: JSON.stringify(formatError("AccessDeniedException", "Vous n'avez pas consulté ce patient", 403))
            };
          }
        }
        
        const vaccinations = await listVaccinationsByPatient(patientIdForVaccinations);
        
        return {
          statusCode: 200,
          body: JSON.stringify(vaccinations)
        };
      }
      
      // ========================================================================
      // Route par défaut
      // ========================================================================
      
      default: {
        return {
          statusCode: 404,
          body: JSON.stringify(formatError("NotFound", `Route ${httpMethod} ${requestPath} non trouvée`, 404))
        };
      }
    }
    
  } catch (error) {
    console.error("Erreur :", error);
    
    return {
      statusCode: 500,
      body: JSON.stringify(formatError("InternalServerError", "Une erreur interne est survenue", 500))
    };
  }
};
