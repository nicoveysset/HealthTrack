/**
 * HealthTrack API - Disponibilités, Rendez-vous & Comptes Rendus
 * Handler principal pour toutes les routes
 * 
 * Architecture : Handler → Service → Repository
 * 
 * Routes gérées :
 * Disponibilités:
 * - PUT /praticiens/me/disponibilites - Définir les disponibilités hebdomadaires
 * - GET /praticiens/me/disponibilites - Récupérer ses disponibilités
 * - GET /praticiens/{id}/disponibilites - Récupérer les disponibilités d'un praticien
 * 
 * Indisponibilités:
 * - POST /praticiens/me/indisponibilites - Créer une indisponibilité ponctuelle
 * - GET /praticiens/me/indisponibilites - Lister ses indisponibilités
 * - DELETE /indisponibilites/{id} - Supprimer une indisponibilité
 * 
 * Créneaux:
 * - GET /praticiens/{id}/creneaux - Lister les créneaux disponibles
 * 
 * Rendez-vous:
 * - POST /rendezvous - Créer un rendez-vous
 * - GET /rendezvous - Lister les rendez-vous (paginé/filtré)
 * - POST /rendezvous/{id}/confirmer - Confirmer un RDV
 * - POST /rendezvous/{id}/annuler - Annuler un RDV
 * - POST /rendezvous/{id}/en-cours - Passer un RDV en cours
 * - POST /rendezvous/{id}/termine - Terminer un RDV
 * - POST /rendezvous/{id}/non-venu - Marquer un RDV comme non-venu
 * 
 * Comptes Rendus:
 * - POST /rendezvous/{id}/compte-rendu - Créer un compte rendu
 * - GET /rendezvous/{id}/compte-rendu - Récupérer un compte rendu
 */

const jwt = require('jsonwebtoken');
const {
  disponibiliteService,
  indisponibiliteService,
  rendezVousService,
  compteRenduService
} = require('../services');

// Configuration
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
    
    // Normaliser le path : remplacer les IDs réels par les placeholders pour le routing
    // Ex: /rendezvous/rdv-123/confirmer → /rendezvous/{rdvId}/confirmer
    // Note: "me" est un mot réservé, on ne le remplace pas
    const routePath = requestPath
      .replace(/\/praticiens\/(?!me\b)[^/]+\/disponibilites/, '/praticiens/{praticienId}/disponibilites')
      .replace(/\/praticiens\/(?!me\b)[^/]+\/creneaux/, '/praticiens/{praticienId}/creneaux')
      .replace(/\/indisponibilites\/[^/]+/, '/indisponibilites/{indispoId}')
      .replace(/\/rendezvous\/[^/]+\/confirmer/, '/rendezvous/{rdvId}/confirmer')
      .replace(/\/rendezvous\/[^/]+\/annuler/, '/rendezvous/{rdvId}/annuler')
      .replace(/\/rendezvous\/[^/]+\/en-cours/, '/rendezvous/{rdvId}/en-cours')
      .replace(/\/rendezvous\/[^/]+\/termine/, '/rendezvous/{rdvId}/termine')
      .replace(/\/rendezvous\/[^/]+\/non-venu/, '/rendezvous/{rdvId}/non-venu')
      .replace(/\/rendezvous\/[^/]+\/compte-rendu/, '/rendezvous/{rdvId}/compte-rendu');
    
    // Router les requêtes
    switch (`${httpMethod} ${routePath}`) {
      // ========================================================================
      // Disponibilités
      // ========================================================================
      
      case "PUT /praticiens/me/disponibilites": {
        if (!currentUser || currentUser.type !== 'PRATICIEN') {
          return {
            statusCode: 403,
            body: JSON.stringify(formatError("Forbidden", "Seul un praticien peut gérer ses disponibilités", 403))
          };
        }
        
        try {
          const newDispos = requestBody.disponibilites || [];
          const createdDispos = await disponibiliteService.replaceAllDisponibilites(
            currentUser.sub,
            newDispos
          );
          return {
            statusCode: 200,
            body: JSON.stringify(createdDispos)
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
      
      case "GET /praticiens/me/disponibilites": {
        if (!currentUser) {
          return {
            statusCode: 401,
            body: JSON.stringify(formatError("Unauthorized", "Non autorisé", 401))
          };
        }
        
        try {
          const dispons = await disponibiliteService.getDisponibilitesByPraticien(currentUser.sub);
          return {
            statusCode: 200,
            body: JSON.stringify(dispons)
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
      
      case "GET /praticiens/{praticienId}/disponibilites": {
        try {
          const praticienId = requestPath.split('/')[2];
          const dispons = await disponibiliteService.getDisponibilitesByPraticien(praticienId);
          return {
            statusCode: 200,
            body: JSON.stringify(dispons)
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
      // Indisponibilités
      // ========================================================================
      
      case "POST /praticiens/me/indisponibilites": {
        if (!currentUser || currentUser.type !== 'PRATICIEN') {
          return {
            statusCode: 403,
            body: JSON.stringify(formatError("Forbidden", "Seul un praticien peut gérer ses indisponibilités", 403))
          };
        }
        
        try {
          const indispo = await indisponibiliteService.createIndisponibilite({
            ...requestBody,
            praticienId: currentUser.sub
          });
          return {
            statusCode: 201,
            body: JSON.stringify(indispo)
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
      
      case "GET /praticiens/me/indisponibilites": {
        if (!currentUser) {
          return {
            statusCode: 401,
            body: JSON.stringify(formatError("Unauthorized", "Non autorisé", 401))
          };
        }
        
        try {
          const indisponibilites = await indisponibiliteService.getIndisponibilitesByPraticien(currentUser.sub);
          return {
            statusCode: 200,
            body: JSON.stringify(indisponibilites)
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
      
      case "DELETE /indisponibilites/{indispoId}": {
        if (!currentUser) {
          return {
            statusCode: 401,
            body: JSON.stringify(formatError("Unauthorized", "Non autorisé", 401))
          };
        }
        
        try {
          const indispoId = requestPath.split('/')[2];
          await indisponibiliteService.deleteIndisponibilite(indispoId);
          return {
            statusCode: 204,
            body: JSON.stringify({})
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
      // Créneaux
      // ========================================================================
      
      case "GET /praticiens/{praticienId}/creneaux": {
        try {
          const praticienId = requestPath.split('/')[2];
          const { dateDebut, dateFin } = queryStringParameters || {};
          
          if (!dateDebut || !dateFin) {
            return {
              statusCode: 400,
              body: JSON.stringify(formatError("ValidationError", "dateDebut et dateFin sont requis", 400))
            };
          }
          
          const creneaux = await rendezVousService.calculateCreneauxDisponibles(
            praticienId,
            dateDebut,
            dateFin
          );
          
          return {
            statusCode: 200,
            body: JSON.stringify(creneaux)
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
      // Rendez-vous
      // ========================================================================
      
      case "POST /rendezvous": {
        if (!currentUser) {
          return {
            statusCode: 401,
            body: JSON.stringify(formatError("Unauthorized", "Non autorisé", 401))
          };
        }
        
        try {
          const { praticienId, date, heure, duree } = requestBody;
          
          if (!praticienId || !date || !heure) {
            return {
              statusCode: 400,
              body: JSON.stringify(formatError("ValidationError", "praticienId, date et heure sont requis", 400))
            };
          }
          
          // Créer le RDV en tant que patient
          const rdv = await rendezVousService.createRendezVous({
            praticienId,
            patientId: currentUser.sub,
            date,
            heure,
            duree
          });
          
          return {
            statusCode: 201,
            body: JSON.stringify(rdv)
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
      
      case "GET /rendezvous": {
        if (!currentUser) {
          return {
            statusCode: 401,
            body: JSON.stringify(formatError("Unauthorized", "Non autorisé", 401))
          };
        }
        
        try {
          const { statut, dateDebut, dateFin, page = 1, limit = 10 } = queryStringParameters || {};
          
          const filters = {
            statut,
            dateDebut,
            dateFin
          };
          
          if (currentUser.type === 'PATIENT') {
            filters.patientId = currentUser.sub;
          } else if (currentUser.type === 'PRATICIEN') {
            filters.praticienId = currentUser.sub;
          }
          
          const result = await rendezVousService.listRendezVous(filters, parseInt(page), parseInt(limit));
          
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
      // Transitions de statut des RDV
      // ========================================================================
      
      case "POST /rendezvous/{rdvId}/confirmer": {
        if (!currentUser) {
          return {
            statusCode: 401,
            body: JSON.stringify(formatError("Unauthorized", "Non autorisé", 401))
          };
        }
        
        try {
          const rdvId = requestPath.split('/')[2];
          const rdv = await rendezVousService.getRendezVous(rdvId);
          
          if (!rdv) {
            return {
              statusCode: 404,
              body: JSON.stringify(formatError("NotFound", "Rendez-vous non trouvé", 404))
            };
          }
          
          // Vérifier que l'utilisateur est soit le patient soit le praticien
          if (rdv.patientId !== currentUser.sub && rdv.praticienId !== currentUser.sub) {
            return {
              statusCode: 403,
              body: JSON.stringify(formatError("Forbidden", "Vous n'êtes pas autorisé à modifier ce rendez-vous", 403))
            };
          }
          
          const updatedRdv = await rendezVousService.confirmerRendezVous(
            rdvId,
            currentUser.sub,
            currentUser.type
          );
          
          return {
            statusCode: 200,
            body: JSON.stringify(updatedRdv)
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
      
      case "POST /rendezvous/{rdvId}/annuler": {
        if (!currentUser) {
          return {
            statusCode: 401,
            body: JSON.stringify(formatError("Unauthorized", "Non autorisé", 401))
          };
        }
        
        try {
          const rdvId = requestPath.split('/')[2];
          const updatedRdv = await rendezVousService.annulerRendezVous(
            rdvId,
            currentUser.sub,
            currentUser.type
          );
          
          return {
            statusCode: 200,
            body: JSON.stringify(updatedRdv)
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
      
      case "POST /rendezvous/{rdvId}/en-cours":
      case "POST /rendezvous/{rdvId}/termine":
      case "POST /rendezvous/{rdvId}/non-venu": {
        if (!currentUser) {
          return {
            statusCode: 401,
            body: JSON.stringify(formatError("Unauthorized", "Non autorisé", 401))
          };
        }
        
        try {
          const rdvId = requestPath.split('/')[2];
          const action = requestPath.split('/')[3];
          let updatedRdv;
          
          switch (action) {
            case "en-cours":
              updatedRdv = await rendezVousService.demarrerRendezVous(rdvId, currentUser.sub, currentUser.type);
              break;
            case "termine":
              updatedRdv = await rendezVousService.terminerRendezVous(rdvId, currentUser.sub, currentUser.type);
              break;
            case "non-venu":
              updatedRdv = await rendezVousService.marquerNonVenu(rdvId, currentUser.sub, currentUser.type);
              break;
          }
          
          return {
            statusCode: 200,
            body: JSON.stringify(updatedRdv)
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
      // Comptes Rendus
      // ========================================================================
      
      case "POST /rendezvous/{rdvId}/compte-rendu": {
        if (!currentUser || currentUser.type !== 'PRATICIEN') {
          return {
            statusCode: 403,
            body: JSON.stringify(formatError("Forbidden", "Seul un praticien peut créer un compte rendu", 403))
          };
        }
        
        try {
          const rdvId = requestPath.split('/')[2];
          const { contenu } = requestBody;
          
          if (!contenu) {
            return {
              statusCode: 400,
              body: JSON.stringify(formatError("ValidationError", "contenu est requis", 400))
            };
          }
          
          // Récupérer le RDV pour obtenir patientId et praticienId
          const rdv = await rendezVousService.getRendezVous(rdvId);
          if (!rdv) {
            return {
              statusCode: 404,
              body: JSON.stringify(formatError("NotFound", "Rendez-vous non trouvé", 404))
            };
          }
          
          const cr = await compteRenduService.createCompteRendu({
            rdvId,
            praticienId: rdv.praticienId,
            patientId: rdv.patientId,
            contenu
          }, currentUser.sub);
          
          return {
            statusCode: 201,
            headers: {
              Location: `/rendezvous/${rdvId}/compte-rendu`
            },
            body: JSON.stringify(cr)
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
      
      case "GET /rendezvous/{rdvId}/compte-rendu": {
        if (!currentUser) {
          return {
            statusCode: 401,
            body: JSON.stringify(formatError("Unauthorized", "Non autorisé", 401))
          };
        }
        
        try {
          const rdvId = requestPath.split('/')[2];
          const cr = await compteRenduService.getCompteRenduByRdv(rdvId, currentUser.sub);
          
          return {
            statusCode: 200,
            body: JSON.stringify(cr)
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
    
    return {
      statusCode: 500,
      body: JSON.stringify(formatError("InternalServerError", "Une erreur interne est survenue", 500))
    };
  }
};
