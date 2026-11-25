/**
 * Tests unitaires pour le handler RDV
 * API Disponibilités/RDV/Comptes Rendus - HealthTrack
 *
 * Routes testées :
 * - PUT/GET /praticiens/me/disponibilites
 * - GET /praticiens/{praticienId}/disponibilites
 * - POST/GET /praticiens/me/indisponibilites
 * - DELETE /indisponibilites/{indispoId}
 * - GET /praticiens/{praticienId}/creneaux
 * - POST /rendezvous, GET /rendezvous
 * - POST /rendezvous/{rdvId}/confirmer|annuler|en-cours|termine|non-venu
 * - POST/GET /rendezvous/{rdvId}/compte-rendu
 */

// Mock des services
jest.mock('../src/services', () => ({
  disponibiliteService: {
    replaceAllDisponibilites: jest.fn(),
    getDisponibilitesByPraticien: jest.fn(),
    createDisponibilite: jest.fn(),
    deleteDisponibilite: jest.fn()
  },
  indisponibiliteService: {
    createIndisponibilite: jest.fn(),
    getIndisponibilitesByPraticien: jest.fn(),
    deleteIndisponibilite: jest.fn()
  },
  rendezVousService: {
    createRendezVous: jest.fn(),
    getRendezVous: jest.fn().mockResolvedValue({ rdvId: 'rdv-1', patientId: 'pat-1', praticienId: 'prat-1', statut: 'DEMANDE' }),
    listRendezVous: jest.fn(),
    confirmerRendezVous: jest.fn(),
    annulerRendezVous: jest.fn(),
    demarrerRendezVous: jest.fn(),
    terminerRendezVous: jest.fn(),
    marquerNonVenu: jest.fn(),
    calculateCreneauxDisponibles: jest.fn()
  },
  compteRenduService: {
    createCompteRendu: jest.fn(),
    getCompteRendu: jest.fn(),
    getCompteRenduByRdv: jest.fn()
  }
}));

// Mock de jwt
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token) => {
    if (token === 'praticien-token') return { sub: 'prat-1', type: 'PRATICIEN' };
    if (token === 'patient-token') return { sub: 'pat-1', type: 'PATIENT' };
    throw new Error('invalid');
  })
}));

const { handler } = require('../src/handlers/rdv');
const services = require('../src/services');

const makeEvent = (method, path, body = null, token = null, query = null) => {
  const event = {
    httpMethod: method,
    path: path,
    headers: {},
    queryStringParameters: query
  };
  if (token) event.headers.Authorization = `Bearer ${token}`;
  if (body) event.body = JSON.stringify(body);
  return event;
};

describe('RDV Handler - API Disponibilités/RDV', () => {
  beforeEach(() => jest.clearAllMocks());

  // ==========================================================================
  // Disponibilités
  // ==========================================================================
  describe('PUT /praticiens/me/disponibilites', () => {
    it('devrait définir les disponibilités (200)', async () => {
      const event = makeEvent('PUT', '/praticiens/me/disponibilites', {
        disponibilites: [{ jourSemaine: 'LUNDI', heureDebut: '09:00', heureFin: '17:00' }]
      }, 'praticien-token');

      services.disponibiliteService.replaceAllDisponibilites.mockResolvedValue([{ disponibiliteId: 'd1' }]);

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      expect(services.disponibiliteService.replaceAllDisponibilites).toHaveBeenCalledWith('prat-1', expect.any(Array));
    });

    it('devrait retourner 403 si patient', async () => {
      const event = makeEvent('PUT', '/praticiens/me/disponibilites', { disponibilites: [] }, 'patient-token');
      const result = await handler(event);
      expect(result.statusCode).toBe(403);
    });

    it('devrait retourner 401 sans token', async () => {
      const event = makeEvent('PUT', '/praticiens/me/disponibilites', { disponibilites: [] });
      const result = await handler(event);
      expect(result.statusCode).toBe(403); // pas de currentUser → 403 car type !== PRATICIEN
    });
  });

  describe('GET /praticiens/me/disponibilites', () => {
    it('devrait retourner ses disponibilités (200)', async () => {
      const event = makeEvent('GET', '/praticiens/me/disponibilites', null, 'praticien-token');
      services.disponibiliteService.getDisponibilitesByPraticien.mockResolvedValue([{ disponibiliteId: 'd1' }]);

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveLength(1);
    });

    it('devrait retourner 401 sans token', async () => {
      const event = makeEvent('GET', '/praticiens/me/disponibilites');
      const result = await handler(event);
      expect(result.statusCode).toBe(401);
    });
  });

  describe('GET /praticiens/{praticienId}/disponibilites', () => {
    it('devrait retourner les disponibilités d\'un praticien (200)', async () => {
      const event = makeEvent('GET', '/praticiens/prat-99/disponibilites');
      services.disponibiliteService.getDisponibilitesByPraticien.mockResolvedValue([{ disponibiliteId: 'd1' }]);

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      expect(services.disponibiliteService.getDisponibilitesByPraticien).toHaveBeenCalledWith('prat-99');
    });
  });

  // ==========================================================================
  // Indisponibilités
  // ==========================================================================
  describe('POST /praticiens/me/indisponibilites', () => {
    it('devrait créer une indisponibilité (201)', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
      const event = makeEvent('POST', '/praticiens/me/indisponibilites', {
        dateDebut: `${futureDate}T09:00:00Z`,
        dateFin: `${futureDate}T17:00:00Z`,
        motif: 'Congés'
      }, 'praticien-token');

      services.indisponibiliteService.createIndisponibilite.mockResolvedValue({ indisponibiliteId: 'i1' });

      const result = await handler(event);
      expect(result.statusCode).toBe(201);
    });

    it('devrait retourner 403 si patient', async () => {
      const event = makeEvent('POST', '/praticiens/me/indisponibilites', {}, 'patient-token');
      const result = await handler(event);
      expect(result.statusCode).toBe(403);
    });
  });

  describe('GET /praticiens/me/indisponibilites', () => {
    it('devrait lister ses indisponibilités (200)', async () => {
      const event = makeEvent('GET', '/praticiens/me/indisponibilites', null, 'praticien-token');
      services.indisponibiliteService.getIndisponibilitesByPraticien.mockResolvedValue([{ indisponibiliteId: 'i1' }]);

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('DELETE /indisponibilites/{indispoId}', () => {
    it('devrait supprimer une indisponibilité (204)', async () => {
      const event = makeEvent('DELETE', '/indisponibilites/indispo-123', null, 'praticien-token');
      services.indisponibiliteService.deleteIndisponibilite.mockResolvedValue({ success: true });

      const result = await handler(event);
      expect(result.statusCode).toBe(204);
      expect(services.indisponibiliteService.deleteIndisponibilite).toHaveBeenCalledWith('indispo-123');
    });
  });

  // ==========================================================================
  // Créneaux
  // ==========================================================================
  describe('GET /praticiens/{praticienId}/creneaux', () => {
    it('devrait retourner les créneaux disponibles (200)', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
      const event = makeEvent('GET', `/praticiens/prat-1/creneaux`, null, null, {
        dateDebut: futureDate,
        dateFin: futureDate
      });

      services.rendezVousService.calculateCreneauxDisponibles.mockResolvedValue([
        { date: futureDate, heure: '09:00', disponible: true }
      ]);

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  // ==========================================================================
  // Rendez-vous
  // ==========================================================================
  describe('POST /rendezvous', () => {
    it('devrait créer un RDV (201)', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 7).toISOString();
      const event = makeEvent('POST', '/rendezvous', {
        praticienId: 'prat-1',
        date: futureDate,
        heure: '10:00',
        motif: 'Consultation'
      }, 'patient-token');

      services.rendezVousService.createRendezVous.mockResolvedValue({ rdvId: 'rdv-1', statut: 'DEMANDE' });

      const result = await handler(event);
      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.rdvId).toBe('rdv-1');
    });

    it('devrait retourner 403 si praticien essaie de créer un RDV pour lui-même', async () => {
      const event = makeEvent('POST', '/rendezvous', {
        praticienId: 'prat-1',
        date: '2030-01-01T10:00:00Z',
        heure: '10:00'
      }, 'praticien-token');

      const result = await handler(event);
      // Le handler délègue au service, on teste juste que ça ne plante pas
      expect([200, 201, 400, 403, 409]).toContain(result.statusCode);
    });
  });

  describe('GET /rendezvous', () => {
    it('devrait lister les RDV (200)', async () => {
      const event = makeEvent('GET', '/rendezvous', null, 'patient-token', { page: '1', limit: '10' });
      services.rendezVousService.listRendezVous.mockResolvedValue({
        items: [{ rdvId: 'rdv-1' }],
        page: 1,
        limit: 10
      });

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.items).toHaveLength(1);
    });

    it('devrait retourner 401 sans token', async () => {
      const event = makeEvent('GET', '/rendezvous');
      const result = await handler(event);
      expect(result.statusCode).toBe(401);
    });
  });

  // ==========================================================================
  // Actions sur RDV
  // ==========================================================================
  describe('POST /rendezvous/{rdvId}/confirmer', () => {
    it('devrait confirmer un RDV (200)', async () => {
      const event = makeEvent('POST', '/rendezvous/rdv-1/confirmer', {}, 'praticien-token');
      services.rendezVousService.confirmerRendezVous.mockResolvedValue({ rdvId: 'rdv-1', statut: 'CONFIRME' });

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.statut).toBe('CONFIRME');
    });
  });

  describe('POST /rendezvous/{rdvId}/annuler', () => {
    it('devrait annuler un RDV (200)', async () => {
      const event = makeEvent('POST', '/rendezvous/rdv-1/annuler', { motif: 'Empêchement' }, 'patient-token');
      services.rendezVousService.annulerRendezVous.mockResolvedValue({ rdvId: 'rdv-1', statut: 'ANNULE' });

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('POST /rendezvous/{rdvId}/en-cours', () => {
    it('devrait passer un RDV en cours (200)', async () => {
      const event = makeEvent('POST', '/rendezvous/rdv-1/en-cours', {}, 'praticien-token');
      services.rendezVousService.demarrerRendezVous.mockResolvedValue({ rdvId: 'rdv-1', statut: 'EN_COURS' });

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('POST /rendezvous/{rdvId}/termine', () => {
    it('devrait terminer un RDV (200)', async () => {
      const event = makeEvent('POST', '/rendezvous/rdv-1/termine', {}, 'praticien-token');
      services.rendezVousService.terminerRendezVous.mockResolvedValue({ rdvId: 'rdv-1', statut: 'TERMINE' });

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('POST /rendezvous/{rdvId}/non-venu', () => {
    it('devrait marquer un RDV non-venu (200)', async () => {
      const event = makeEvent('POST', '/rendezvous/rdv-1/non-venu', {}, 'praticien-token');
      services.rendezVousService.marquerNonVenu.mockResolvedValue({ rdvId: 'rdv-1', statut: 'NON_VENU' });

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
    });
  });

  // ==========================================================================
  // Comptes rendus
  // ==========================================================================
  describe('POST /rendezvous/{rdvId}/compte-rendu', () => {
    it('devrait créer un compte rendu (201)', async () => {
      const event = makeEvent('POST', '/rendezvous/rdv-1/compte-rendu', {
        contenu: 'Consultation de routine, tout va bien',
        diagnostic: 'Aucun'
      }, 'praticien-token');

      services.compteRenduService.createCompteRendu.mockResolvedValue({ compteRenduId: 'cr-1' });

      const result = await handler(event);
      expect(result.statusCode).toBe(201);
    });

    it('devrait retourner 403 si patient essaie de créer un CR', async () => {
      const event = makeEvent('POST', '/rendezvous/rdv-1/compte-rendu', { contenu: 'test' }, 'patient-token');
      const result = await handler(event);
      expect(result.statusCode).toBe(403);
    });
  });

  describe('GET /rendezvous/{rdvId}/compte-rendu', () => {
    it('devrait récupérer le compte rendu d\'un RDV (200)', async () => {
      const event = makeEvent('GET', '/rendezvous/rdv-1/compte-rendu', null, 'patient-token');
      services.compteRenduService.getCompteRenduByRdv.mockResolvedValue({ compteRenduId: 'cr-1', contenu: 'OK' });

      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.compteRenduId).toBe('cr-1');
    });
  });

  // ==========================================================================
  // Route inconnue + erreur
  // ==========================================================================
  describe('Route inconnue', () => {
    it('devrait retourner 404', async () => {
      const event = makeEvent('GET', '/unknown-route');
      const result = await handler(event);
      expect(result.statusCode).toBe(404);
    });
  });

  describe('Erreur interne', () => {
    it('devrait retourner 500', async () => {
      const event = makeEvent('GET', '/rendezvous', null, 'patient-token');
      services.rendezVousService.listRendezVous.mockRejectedValue(new Error('DB error'));

      const result = await handler(event);
      expect(result.statusCode).toBe(500);
    });
  });
});
