/**
 * HealthTrack API - Ordonnances & Médicaments
 * Handler principal pour toutes les routes
 * 
 * Routes gérées :
 * Ordonnances:
 * - POST /ordonnances - Créer une ordonnance (sur un compte rendu finalisé)
 * - GET /ordonnances/{id} - Récupérer une ordonnance
 * - GET /ordonnances - Lister les ordonnances (paginé/filtré)
 * 
 * Lignes de prescription:
 * - POST /ordonnances/{id}/lignes - Ajouter une ligne à une ordonnance
 * - DELETE /ordonnances/{id}/lignes/{ligneId} - Supprimer une ligne
 * - GET /ordonnances/{id}/lignes - Lister les lignes d'une ordonnance
 * 
 * Médicaments:
 * - GET /medicaments - Lister les médicaments (paginé/filtré)
 * - POST /medicaments - Créer un médicament (admin)
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { CloudWatchLogsClient } = require("@aws-sdk/client-cloudwatch-logs");
const { v4: uuidv4 } = require("uuid");

// Initialiser DynamoDB
const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

// Initialiser CloudWatch Logs
const cwLogsClient = new CloudWatchLogsClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });

// Noms des tables
const TABLES = {
  utilisateurs: "healthtrack-utilisateurs",
  ordonnances: "healthtrack-ordonnances",
  lignesPrescription: "healthtrack-lignes-prescription",
  medicaments: "healthtrack-medicaments",
  comptesRendus: "healthtrack-comptes-rendus",
  allergies: "healthtrack-allergies"
};

// Statuts des ordonnances
const ORDONNANCE_STATUT = {
  ACTIVE: 'ACTIVE',
  EXPIREE: 'EXPIREE'
};

// Formes de médicaments
const MEDICAMENT_FORME = {
  COMPRIME: 'COMPRIME',
  SIROP: 'SIROP',
  INJECTION: 'INJECTION',
  AUTRE: 'AUTRE'
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
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    message,
    details
  }));
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
 * Récupère un compte rendu par ID
 */
const getCompteRenduById = async (compteRenduId) => {
  const params = {
    TableName: TABLES.comptesRendus,
    Key: { compteRenduId }
  };
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
};

/**
 * Vérifie si une allergie est en conflit avec un médicament
 */
const checkAllergieConflict = async (patientId, medicamentId) => {
  // 1. Récupérer toutes les allergies du patient
  const params = {
    TableName: TABLES.allergies,
    IndexName: "byPatient",
    KeyConditionExpression: "patientId = :patientId",
    ExpressionAttributeValues: {
      ":patientId": patientId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  
  // 2. Vérifier si une allergie correspond au médicament
  for (const allergie of result.Items || []) {
    if (allergie.medicamentConcerne === medicamentId) {
      // Log CloudWatch
      await logToCloudWatch('Conflit allergie-médicament détecté', {
        patientId,
        medicamentId,
        allergieId: allergie.allergieId
      });
      return true;
    }
  }
  
  return false;
};

/**
 * Vérifie l'expiration paresseuse et met à jour si nécessaire
 */
const checkExpirationParesseuse = async (ordonnance) => {
  const now = new Date();
  const dateValidite = new Date(ordonnance.dateValidite);
  
  if (dateValidite < now && ordonnance.statut === ORDONNANCE_STATUT.ACTIVE) {
    // Mettre à jour le statut en EXPIREE
    const params = {
      TableName: TABLES.ordonnances,
      Key: { ordonnanceId: ordonnance.ordonnanceId },
      UpdateExpression: "SET statut = :statut",
      ExpressionAttributeValues: {
        ":statut": ORDONNANCE_STATUT.EXPIREE
      },
      ReturnValues: "ALL_NEW"
    };
    
    const result = await docClient.send(new UpdateCommand(params));
    
    // Log CloudWatch
    await logToCloudWatch('Ordonnance expirée - Mise à jour paresseuse', {
      ordonnanceId: ordonnance.ordonnanceId,
      patientId: ordonnance.patientId,
      dateValidite: ordonnance.dateValidite
    });
    
    return result.Attributes;
  }
  
  return ordonnance;
};

// =============================================================================
// Ordonnances
// =============================================================================

/**
 * Récupère une ordonnance par ID
 */
const getOrdonnanceById = async (ordonnanceId) => {
  const params = {
    TableName: TABLES.ordonnances,
    Key: { ordonnanceId }
  };
  const result = await docClient.send(new GetCommand(params));
  
  if (result.Item) {
    // Vérifier l'expiration paresseuse
    return await checkExpirationParesseuse(result.Item);
  }
  
  return null;
};

/**
 * Crée une ordonnance
 */
const createOrdonnance = async (ordonnanceData) => {
  const ordonnanceId = uuidv4();
  const now = new Date().toISOString();
  
  // Date de validité par défaut : 3 mois
  const dateValidite = new Date();
  dateValidite.setMonth(dateValidite.getMonth() + 3);
  
  const ordonnance = {
    ordonnanceId,
    compteRenduId: ordonnanceData.compteRenduId,
    patientId: ordonnanceData.patientId,
    praticienId: ordonnanceData.praticienId,
    dateEmission: now,
    dateValidite: dateValidite.toISOString(),
    statut: ORDONNANCE_STATUT.ACTIVE,
    createdAt: now,
    updatedAt: now
  };
  
  const params = {
    TableName: TABLES.ordonnances,
    Item: ordonnance
  };
  
  await docClient.send(new PutCommand(params));
  return ordonnance;
};

/**
 * Met à jour une ordonnance
 */
const updateOrdonnance = async (ordonnanceId, updates) => {
  const now = new Date().toISOString();
  updates.updatedAt = now;
  
  // Vérifier l'expiration paresseuse avant la mise à jour
  const ordonnance = await getOrdonnanceById(ordonnanceId);
  if (!ordonnance) {
    throw new Error("Ordonnance non trouvée");
  }
  
  // Si l'ordonnance est expirée, ne pas permettre la modification
  if (ordonnance.statut === ORDONNANCE_STATUT.EXPIREE) {
    throw new Error("PrescriptionExpiredException");
  }
  
  const updateExpressionParts = [];
  const expressionAttributeValues = {};
  
  for (const [key, value] of Object.entries(updates)) {
    updateExpressionParts.push(`${key} = :${key}`);
    expressionAttributeValues[`:${key}`] = value;
  }
  
  const params = {
    TableName: TABLES.ordonnances,
    Key: { ordonnanceId },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW"
  };
  
  const result = await docClient.send(new UpdateCommand(params));
  
  // Vérifier l'expiration paresseuse après la mise à jour
  return await checkExpirationParesseuse(result.Attributes);
};

/**
 * Liste les ordonnances (paginé/filtré)
 */
const listOrdonnances = async (filters = {}, page = 1, limit = 10) => {
  const { patientId, statut, dateDebut, dateFin } = filters;
  
  let keyConditionExpression = "";
  let filterExpression = "";
  const expressionAttributeValues = {};
  
  if (patientId) {
    keyConditionExpression = "patientId = :patientId";
    expressionAttributeValues[":patientId"] = patientId;
  }
  
  if (statut) {
    filterExpression += (filterExpression ? " AND " : "") + "statut = :statut";
    expressionAttributeValues[":statut"] = statut;
  }
  
  if (dateDebut) {
    filterExpression += (filterExpression ? " AND " : "") + "dateEmission >= :dateDebut";
    expressionAttributeValues[":dateDebut"] = dateDebut;
  }
  
  if (dateFin) {
    filterExpression += (filterExpression ? " AND " : "") + "dateEmission <= :dateFin";
    expressionAttributeValues[":dateFin"] = dateFin;
  }
  
  const params = {
    TableName: TABLES.ordonnances,
    IndexName: keyConditionExpression ? "byPatientAndDate" : undefined,
    KeyConditionExpression: keyConditionExpression || undefined,
    FilterExpression: filterExpression || undefined,
    ExpressionAttributeValues: expressionAttributeValues,
    Limit: limit
  };
  
  const result = await docClient.send(new QueryCommand(params));
  
  // Vérifier l'expiration paresseuse pour chaque ordonnance
  const ordonnances = [];
  for (const ordonnance of result.Items || []) {
    const checkedOrdonnance = await checkExpirationParesseuse(ordonnance);
    ordonnances.push(checkedOrdonnance);
  }
  
  return {
    items: ordonnances,
    count: ordonnances.length,
    page: parseInt(page),
    limit: parseInt(limit)
  };
};

// =============================================================================
// Lignes de prescription
// =============================================================================

/**
 * Récupère une ligne de prescription par ID
 */
const getLignePrescription = async (ordonnanceId, ligneId) => {
  const params = {
    TableName: TABLES.lignesPrescription,
    Key: { ordonnanceId, ligneId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
};

/**
 * Ajoute une ligne à une ordonnance
 */
const createLignePrescription = async (ordonnanceId, ligneData) => {
  const ligneId = uuidv4();
  
  // Vérifier que l'ordonnance existe
  const ordonnance = await getOrdonnanceById(ordonnanceId);
  if (!ordonnance) {
    throw new Error("Ordonnance non trouvée");
  }
  
  // Vérifier que l'ordonnance n'est pas expirée
  if (ordonnance.statut === ORDONNANCE_STATUT.EXPIREE) {
    throw new Error("PrescriptionExpiredException");
  }
  
  // Vérifier les conflits d'allergie
  const hasConflict = await checkAllergieConflict(ordonnance.patientId, ligneData.medicamentId);
  if (hasConflict) {
    await logToCloudWatch('Conflit allergie détecté lors de l\'ajout d\'une ligne', {
      ordonnanceId,
      patientId: ordonnance.patientId,
      medicamentId: ligneData.medicamentId
    });
    throw new Error("AllergyConflictException");
  }
  
  // Vérifier la durée > 90 jours
  if (ligneData.duree && ligneData.duree > 90) {
    await logToCloudWatch('Durée de prescription > 90 jours', {
      ordonnanceId,
      ligneId,
      duree: ligneData.duree
    });
    // Ne pas bloquer, mais logger (selon PLAN.md)
  }
  
  const ligne = {
    ordonnanceId,
    ligneId,
    medicamentId: ligneData.medicamentId,
    posologie: ligneData.posologie,
    duree: ligneData.duree || 0,
    instructions: ligneData.instructions || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const params = {
    TableName: TABLES.lignesPrescription,
    Item: ligne
  };
  
  await docClient.send(new PutCommand(params));
  return ligne;
};

/**
 * Supprime une ligne de prescription
 */
const deleteLignePrescription = async (ordonnanceId, ligneId) => {
  const params = {
    TableName: TABLES.lignesPrescription,
    Key: { ordonnanceId, ligneId }
  };
  
  await docClient.send(new DeleteCommand(params));
  return { success: true };
};

/**
 * Liste les lignes de prescription d'une ordonnance
 */
const listLignesPrescription = async (ordonnanceId) => {
  const params = {
    TableName: TABLES.lignesPrescription,
    KeyConditionExpression: "ordonnanceId = :ordonnanceId",
    ExpressionAttributeValues: {
      ":ordonnanceId": ordonnanceId
    }
  };
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
};

// =============================================================================
// Médicaments
// =============================================================================

/**
 * Récupère un médicament par ID
 */
const getMedicamentById = async (medicamentId) => {
  const params = {
    TableName: TABLES.medicaments,
    Key: { medicamentId }
  };
  
  const result = await docClient.send(new GetCommand(params));
  return result.Item || null;
};

/**
 * Crée un médicament
 */
const createMedicament = async (medicamentData) => {
  const medicamentId = uuidv4();
  const now = new Date().toISOString();
  
  const medicament = {
    medicamentId,
    nom: medicamentData.nom,
    substanceActive: medicamentData.substanceActive || '',
    forme: medicamentData.forme || MEDICAMENT_FORME.AUTRE,
    description: medicamentData.description || '',
    createdAt: now,
    updatedAt: now
  };
  
  const params = {
    TableName: TABLES.medicaments,
    Item: medicament
  };
  
  await docClient.send(new PutCommand(params));
  return medicament;
};

/**
 * Liste les médicaments (paginé/filtré)
 */
const listMedicaments = async (filters = {}, page = 1, limit = 10) => {
  const { forme, search } = filters;
  
  let indexName = undefined;
  let keyConditionExpression = "";
  const expressionAttributeValues = {};
  let filterExpression = "";
  
  if (forme) {
    indexName = "byForme";
    keyConditionExpression = "forme = :forme";
    expressionAttributeValues[":forme"] = forme;
  }
  
  if (search) {
    filterExpression = "contains(nom, :search) OR contains(substanceActive, :search)";
    expressionAttributeValues[":search"] = search;
  }
  
  const params = {
    TableName: TABLES.medicaments,
    IndexName: indexName,
    KeyConditionExpression: keyConditionExpression || undefined,
    FilterExpression: filterExpression || undefined,
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
      .replace(/\/ordonnances\/[^/]+\/lignes\/[^/]+/, '/ordonnances/{ordonnanceId}/lignes/{ligneId}')
      .replace(/\/ordonnances\/[^/]+\/lignes/, '/ordonnances/{ordonnanceId}/lignes')
      .replace(/\/ordonnances\/[^/]+/, '/ordonnances/{ordonnanceId}');
    
    switch (`${httpMethod} ${routePath}`) {
      // ========================================================================
      // Ordonnances
      // ========================================================================
      
      case "POST /ordonnances": {
        // Créer une ordonnance
        const { compteRenduId } = requestBody;
        
        if (!compteRenduId) {
          return {
            statusCode: 400,
            body: JSON.stringify(formatError("ValidationError", "compteRenduId est requis", 400))
          };
        }
        
        // Vérifier que le compte rendu existe
        const compteRendu = await getCompteRenduById(compteRenduId);
        if (!compteRendu) {
          return {
            statusCode: 404,
            body: JSON.stringify(formatError("NotFound", "Compte rendu non trouvé", 404))
          };
        }
        
        // Vérifier que le compte rendu est finalisé
        if (!compteRendu.dateFinalisation) {
          return {
            statusCode: 409,
            body: JSON.stringify(formatError("ConsultationNotFinalizedException", "Le compte rendu n'est pas finalisé", 409))
          };
        }
        
        // Vérifier que l'utilisateur est le praticien du compte rendu
        if (currentUser.sub !== compteRendu.praticienId) {
          return {
            statusCode: 403,
            body: JSON.stringify(formatError("Forbidden", "Vous n'êtes pas le praticien de ce compte rendu", 403))
          };
        }
        
        const ordonnance = await createOrdonnance({
          compteRenduId,
          patientId: compteRendu.patientId,
          praticienId: currentUser.sub
        });
        
        return {
          statusCode: 201,
          body: JSON.stringify(ordonnance)
        };
      }
      
      case "GET /ordonnances/{ordonnanceId}": {
        const ordonnanceIdFromPath = requestPath.split('/')[2];
        
        const ordonnance = await getOrdonnanceById(ordonnanceIdFromPath);
        if (!ordonnance) {
          return {
            statusCode: 404,
            body: JSON.stringify(formatError("NotFound", "Ordonnance non trouvée", 404))
          };
        }
        
        // Vérifier les permissions
        if (currentUser.sub !== ordonnance.patientId && currentUser.sub !== ordonnance.praticienId) {
          return {
            statusCode: 403,
            body: JSON.stringify(formatError("Forbidden", "Vous n'êtes pas autorisé à consulter cette ordonnance", 403))
          };
        }
        
        // Récupérer les lignes de prescription
        const lignes = await listLignesPrescription(ordonnanceIdFromPath);
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            ...ordonnance,
            lignes
          })
        };
      }
      
      case "GET /ordonnances": {
        const { patientId, statut, page = 1, limit = 10 } = queryStringParameters || {};
        
        const filters = {};
        
        // Un patient ne voit que ses ordonnances
        if (currentUser.type === 'PATIENT') {
          filters.patientId = currentUser.sub;
        }
        // Un praticien voit toutes les ordonnances (ou celles qu'il a créées)
        else if (currentUser.type === 'PRATICIEN') {
          if (patientId) {
            filters.patientId = patientId;
          }
        }
        
        if (statut) filters.statut = statut;
        
        const result = await listOrdonnances(filters, parseInt(page), parseInt(limit));
        
        return {
          statusCode: 200,
          body: JSON.stringify(result)
        };
      }
      
      // ========================================================================
      // Lignes de prescription
      // ========================================================================
      
      case "POST /ordonnances/{ordonnanceId}/lignes": {
        const ordonnanceIdForLigne = requestPath.split('/')[2];
        
        // Vérifier que l'ordonnance existe
        const ordonnanceForLigne = await getOrdonnanceById(ordonnanceIdForLigne);
        if (!ordonnanceForLigne) {
          return {
            statusCode: 404,
            body: JSON.stringify(formatError("NotFound", "Ordonnance non trouvée", 404))
          };
        }
        
        // Vérifier les permissions (seul le praticien peut ajouter des lignes)
        if (currentUser.sub !== ordonnanceForLigne.praticienId) {
          return {
            statusCode: 403,
            body: JSON.stringify(formatError("Forbidden", "Seul le praticien peut ajouter des lignes à une ordonnance", 403))
          };
        }
        
        // Vérifier que l'ordonnance n'est pas expirée
        if (ordonnanceForLigne.statut === ORDONNANCE_STATUT.EXPIREE) {
          return {
            statusCode: 409,
            body: JSON.stringify(formatError("PrescriptionExpiredException", "L'ordonnance est expirée", 409))
          };
        }
        
        const ligne = await createLignePrescription(ordonnanceIdForLigne, requestBody);
        
        return {
          statusCode: 201,
          body: JSON.stringify(ligne)
        };
      }
      
      case "DELETE /ordonnances/{ordonnanceId}/lignes/{ligneId}": {
        const ordonnanceIdForDelete = requestPath.split('/')[2];
        const ligneIdForDelete = requestPath.split('/')[4];
        
        // Vérifier que l'ordonnance existe
        const ordonnanceForDelete = await getOrdonnanceById(ordonnanceIdForDelete);
        if (!ordonnanceForDelete) {
          return {
            statusCode: 404,
            body: JSON.stringify(formatError("NotFound", "Ordonnance non trouvée", 404))
          };
        }
        
        // Vérifier les permissions
        if (currentUser.sub !== ordonnanceForDelete.praticienId) {
          return {
            statusCode: 403,
            body: JSON.stringify(formatError("Forbidden", "Seul le praticien peut supprimer des lignes d'une ordonnance", 403))
          };
        }
        
        await deleteLignePrescription(ordonnanceIdForDelete, ligneIdForDelete);
        
        return {
          statusCode: 204,
          body: JSON.stringify({})
        };
      }
      
      case "GET /ordonnances/{ordonnanceId}/lignes": {
        const ordonnanceIdForList = requestPath.split('/')[2];
        
        // Vérifier que l'ordonnance existe
        const ordonnanceForList = await getOrdonnanceById(ordonnanceIdForList);
        if (!ordonnanceForList) {
          return {
            statusCode: 404,
            body: JSON.stringify(formatError("NotFound", "Ordonnance non trouvée", 404))
          };
        }
        
        // Vérifier les permissions
        if (currentUser.sub !== ordonnanceForList.patientId && currentUser.sub !== ordonnanceForList.praticienId) {
          return {
            statusCode: 403,
            body: JSON.stringify(formatError("Forbidden", "Vous n'êtes pas autorisé à consulter ces lignes", 403))
          };
        }
        
        const lignes = await listLignesPrescription(ordonnanceIdForList);
        
        return {
          statusCode: 200,
          body: JSON.stringify(lignes)
        };
      }
      
      // ========================================================================
      // Médicaments
      // ========================================================================
      
      case "GET /medicaments": {
        const { forme, search, page = 1, limit = 10 } = queryStringParameters || {};
        
        const filters = {};
        if (forme) filters.forme = forme;
        if (search) filters.search = search;
        
        const result = await listMedicaments(filters, parseInt(page), parseInt(limit));
        
        return {
          statusCode: 200,
          body: JSON.stringify(result)
        };
      }
      
      case "POST /medicaments": {
        // Créer un médicament (admin uniquement)
        if (currentUser.type !== 'ADMIN') {
          return {
            statusCode: 403,
            body: JSON.stringify(formatError("Forbidden", "Seul un administrateur peut créer un médicament", 403))
          };
        }
        
        const medicament = await createMedicament(requestBody);
        
        return {
          statusCode: 201,
          body: JSON.stringify(medicament)
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
    
    // Gérer les erreurs connues
    if (error.message === "Ordonnance non trouvée") {
      return {
        statusCode: 404,
        body: JSON.stringify(formatError("NotFound", "Ordonnance non trouvée", 404))
      };
    }
    
    if (error.message === "PrescriptionExpiredException") {
      return {
        statusCode: 409,
        body: JSON.stringify(formatError("PrescriptionExpiredException", "L'ordonnance est expirée", 409))
      };
    }
    
    if (error.message === "ConsultationNotFinalizedException") {
      return {
        statusCode: 409,
        body: JSON.stringify(formatError("ConsultationNotFinalizedException", "Le compte rendu n'est pas finalisé", 409))
      };
    }
    
    if (error.message === "AllergyConflictException") {
      return {
        statusCode: 409,
        body: JSON.stringify(formatError("AllergyConflictException", "Conflit avec une allergie du patient", 409))
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify(formatError("InternalServerError", "Une erreur interne est survenue", 500))
    };
  }
};
