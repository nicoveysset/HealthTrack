/**
 * HealthTrack API - Utilisateurs
 * Handler principal pour toutes les routes de l'API Utilisateurs
 * 
 * Routes gérées :
 * - POST /auth/register       - Inscription d'un nouvel utilisateur
 * - POST /auth/login          - Connexion d'un utilisateur
 * - GET  /utilisateurs/me     - Récupérer son profil
 * - PATCH /utilisateurs/me    - Mettre à jour son profil
 * - PUT /patients/me/medecin-traitant - Désigner son médecin traitant
 * - PATCH /praticiens/me/statut - Changer son statut (EN_CONGE/INACTIF)
 * - GET  /praticiens          - Lister les praticiens (paginé/filtré)
 * 
 * Architecture : Handler → Service → Repository
 */

const jwt = require("jsonwebtoken");
const userService = require("../services/userService");

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Format d'erreur standard
 */
const formatError = (error, message, statusCode) => ({
  error,
  message,
  statusCode
});

/**
 * Handler principal
 */
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
          currentUser = jwt.verify(token, JWT_SECRET);
          console.log("Utilisateur authentifié :", currentUser);
        } catch (jwtError) {
          console.log("Token JWT invalide :", jwtError.message);
        }
      }
    }
    
    // Router les requêtes
    switch (`${httpMethod} ${requestPath}`) {
      // ========================================================================
      // Authentification
      // ========================================================================
      
      case "POST /auth/register": {
        // Inscription - déléguer au service
        try {
          const result = await userService.register(requestBody);
          return {
            statusCode: 201,
            body: JSON.stringify(result)
          };
        } catch (error) {
          if (error.statusCode) {
            return {
              statusCode: error.statusCode,
              body: JSON.stringify(error)
            };
          }
          throw error;
        }
      }
      
      case "POST /auth/login": {
        // Connexion - déléguer au service
        try {
          const { email, password } = requestBody;
          const result = await userService.login(email, password);
          return {
            statusCode: 200,
            body: JSON.stringify(result)
          };
        } catch (error) {
          if (error.statusCode) {
            return {
              statusCode: error.statusCode,
              body: JSON.stringify(error)
            };
          }
          throw error;
        }
      }
      
      // ========================================================================
      // Utilisateurs
      // ========================================================================
      
      case "GET /utilisateurs/me": {
        if (!currentUser) {
          return {
            statusCode: 401,
            body: JSON.stringify(formatError("Unauthorized", "Non autorisé", 401))
          };
        }
        
        try {
          const profile = await userService.getProfile(currentUser.sub);
          return {
            statusCode: 200,
            body: JSON.stringify(profile)
          };
        } catch (error) {
          if (error.statusCode) {
            return {
              statusCode: error.statusCode,
              body: JSON.stringify(error)
            };
          }
          throw error;
        }
      }
      
      case "PATCH /utilisateurs/me": {
        if (!currentUser) {
          return {
            statusCode: 401,
            body: JSON.stringify(formatError("Unauthorized", "Non autorisé", 401))
          };
        }
        
        try {
          const profile = await userService.updateProfile(currentUser.sub, requestBody);
          return {
            statusCode: 200,
            body: JSON.stringify(profile)
          };
        } catch (error) {
          if (error.statusCode) {
            return {
              statusCode: error.statusCode,
              body: JSON.stringify(error)
            };
          }
          throw error;
        }
      }
      
      // ========================================================================
      // Patients
      // ========================================================================
      
      case "PUT /patients/me/medecin-traitant": {
        if (!currentUser || currentUser.type !== 'PATIENT') {
          return {
            statusCode: 403,
            body: JSON.stringify(formatError("Forbidden", "Seul un patient peut désigner son médecin traitant", 403))
          };
        }
        
        const { medecinTraitantId } = requestBody;
        
        if (!medecinTraitantId) {
          return {
            statusCode: 400,
            body: JSON.stringify(formatError("ValidationError", "medecinTraitantId est requis", 400))
          };
        }
        
        try {
          const profile = await userService.setMedecinTraitant(currentUser.sub, medecinTraitantId);
          return {
            statusCode: 200,
            body: JSON.stringify(profile)
          };
        } catch (error) {
          if (error.statusCode) {
            return {
              statusCode: error.statusCode,
              body: JSON.stringify(error)
            };
          }
          throw error;
        }
      }
      
      // ========================================================================
      // Praticiens
      // ========================================================================
      
      case "PATCH /praticiens/me/statut": {
        if (!currentUser || currentUser.type !== 'PRATICIEN') {
          return {
            statusCode: 403,
            body: JSON.stringify(formatError("Forbidden", "Seul un praticien peut modifier son statut", 403))
          };
        }
        
        const { statut: newStatut } = requestBody;
        
        if (!newStatut) {
          return {
            statusCode: 400,
            body: JSON.stringify(formatError("ValidationError", "statut est requis", 400))
          };
        }
        
          try {
            const profile = await userService.updatePraticienStatut(currentUser.sub, newStatut);
            return {
              statusCode: 200,
              body: JSON.stringify(profile)
            };
          } catch (error) {
            if (error.statusCode) {
              return {
                statusCode: error.statusCode,
                body: JSON.stringify(error)
              };
            }
            throw error;
          }
      }
      
      case "GET /praticiens": {
        // Récupérer les paramètres de requête
        const { specialite, statut, page = 1, limit = 10 } = queryStringParameters || {};
        
        const filters = {};
        if (specialite) filters.specialite = specialite;
        if (statut) filters.statut = statut;
        
        try {
          const result = await userService.listPraticiens(filters, parseInt(page), parseInt(limit));
          return {
            statusCode: 200,
            body: JSON.stringify(result)
          };
        } catch (error) {
          if (error.statusCode) {
            return {
              statusCode: error.statusCode,
              body: JSON.stringify(error)
            };
          }
          throw error;
        }
      }
      
      // ========================================================================
      // Route par défaut (pour le proxy)
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
    if (error.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        body: JSON.stringify(formatError("Unauthorized", "Token JWT invalide", 401))
      };
    }
    
    if (error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        body: JSON.stringify(formatError("Unauthorized", "Token JWT expiré", 401))
      };
    }
    
    // Erreur générique
    return {
      statusCode: 500,
      body: JSON.stringify(formatError("InternalServerError", "Une erreur interne est survenue", 500))
    };
  }
};

// Pour les tests locaux
if (require.main === module) {
  const mockEvent = {
    httpMethod: 'POST',
    path: '/auth/register',
    headers: {},
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password123',
      type: 'PATIENT',
      firstName: 'Test',
      lastName: 'User'
    })
  };
  
  exports.handler(mockEvent, {}, (err, result) => {
    if (err) {
      console.error('Erreur :', err);
    } else {
      console.log('Résultat :', result);
    }
  });
}
