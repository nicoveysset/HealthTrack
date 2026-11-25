/**
 * Tests unitaires pour le handler Ordonnance
 * API Ordonnances - HealthTrack
 *
 * Le handler utilise directement DynamoDB, on mock les SDK AWS.
 *
 * Routes testées :
 * - POST /ordonnances
 * - GET /ordonnances/{ordonnanceId}
 * - GET /ordonnances
 * - POST /ordonnances/{ordonnanceId}/lignes
 * - DELETE /ordonnances/{ordonnanceId}/lignes/{ligneId}
 * - GET /ordonnances/{ordonnanceId}/lignes
 * - GET /medicaments
 * - POST /medicaments
 */

// Mock AWS SDK DynamoDB
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend }))
  },
  PutCommand: jest.fn((params) => ({ type: 'Put', ...params })),
  GetCommand: jest.fn((params) => ({ type: 'Get', ...params })),
  UpdateCommand: jest.fn((params) => ({ type: 'Update', ...params })),
  QueryCommand: jest.fn((params) => ({ type: 'Query', ...params })),
  ScanCommand: jest.fn((params) => ({ type: 'Scan', ...params })),
  DeleteCommand: jest.fn((params) => ({ type: 'Delete', ...params }))
}));

// Mock CloudWatch
jest.mock('@aws-sdk/client-cloudwatch-logs', () => ({
  CloudWatchLogsClient: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutLogEventsCommand: jest.fn((params) => params)
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234')
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token) => {
    if (token === 'patient-token') return { sub: 'pat-1', type: 'PATIENT' };
    if (token === 'praticien-token') return { sub: 'prat-1', type: 'PRATICIEN' };
    if (token === 'admin-token') return { sub: 'admin-1', type: 'ADMIN' };
    throw new Error('invalid');
  })
}));

const { handler } = require('../src/handlers/ordonnance');

const makeEvent = (method, path, body = null, token = 'praticien-token', query = null) => {
  const event = {
    httpMethod: method,
    path: path,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    queryStringParameters: query
  };
  if (body) event.body = JSON.stringify(body);
  return event;
};

describe('Ordonnance Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
  });

  // ==========================================================================
  // POST /ordonnances
  // ==========================================================================
  describe('POST /ordonnances', () => {
    it('devrait créer une ordonnance (201)', async () => {
      mockSend.mockImplementation((cmd) => {
        const t = cmd.TableName || '';
        if (cmd.type === 'Get' && t === 'healthtrack-comptes-rendus') {
          return Promise.resolve({ Item: { compteRenduId: 'cr-1', patientId: 'pat-1', praticienId: 'prat-1', dateFinalisation: new Date().toISOString() } });
        }
        if (cmd.type === 'Put') return Promise.resolve({});
        if (cmd.type === 'Query' || cmd.type === 'Scan') return Promise.resolve({ Items: [] });
        return Promise.resolve({});
      });

      const event = makeEvent('POST', '/ordonnances', {
        compteRenduId: 'cr-1'
      }, 'praticien-token');

      const result = await handler(event);
      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.ordonnanceId).toBe('mock-uuid-1234');
    });

    it('devrait retourner 400 si compteRenduId manquant', async () => {
      const event = makeEvent('POST', '/ordonnances', {}, 'praticien-token');
      const result = await handler(event);
      expect(result.statusCode).toBe(400);
    });

    it('devrait retourner 403 si patient essaie de créer une ordonnance', async () => {
      mockSend.mockImplementation((cmd) => {
        const t = cmd.TableName || '';
        if (cmd.type === 'Get' && t === 'healthtrack-comptes-rendus') {
          return Promise.resolve({ Item: { compteRenduId: 'cr-1', patientId: 'pat-1', praticienId: 'prat-1', dateFinalisation: new Date().toISOString() } });
        }
        return Promise.resolve({});
      });

      const event = makeEvent('POST', '/ordonnances', { compteRenduId: 'cr-1' }, 'patient-token');
      const result = await handler(event);
      expect(result.statusCode).toBe(403);
    });
  });

  // ==========================================================================
  // GET /ordonnances/{ordonnanceId}
  // ==========================================================================
  describe('GET /ordonnances/{ordonnanceId}', () => {
    it('devrait retourner une ordonnance (200)', async () => {
      mockSend.mockImplementation((cmd) => {
        const t = cmd.TableName || '';
        if (cmd.type === 'Get' && t === 'healthtrack-ordonnances') {
          return Promise.resolve({ Item: { ordonnanceId: 'ord-1', patientId: 'pat-1', praticienId: 'prat-1', statut: 'ACTIVE', dateExpiration: new Date(Date.now() + 86400000 * 30).toISOString() } });
        }
        if (cmd.type === 'Query' || cmd.type === 'Scan') return Promise.resolve({ Items: [] });
        return Promise.resolve({});
      });

      const event = makeEvent('GET', '/ordonnances/ord-1', null, 'praticien-token');
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.ordonnanceId).toBe('ord-1');
    });

    it('devrait retourner 404 si ordonnance non trouvée', async () => {
      mockSend.mockResolvedValue({});

      const event = makeEvent('GET', '/ordonnances/unknown', null, 'praticien-token');
      const result = await handler(event);
      expect(result.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // GET /ordonnances
  // ==========================================================================
  describe('GET /ordonnances', () => {
    it('devrait lister les ordonnances (200)', async () => {
      mockSend.mockResolvedValue({ Items: [{ ordonnanceId: 'ord-1' }], Count: 1 });

      const event = makeEvent('GET', '/ordonnances', null, 'praticien-token', { page: '1', limit: '10' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.items).toHaveLength(1);
    });

    it('devrait retourner 401 sans token', async () => {
      const event = makeEvent('GET', '/ordonnances', null, null);
      const result = await handler(event);
      expect(result.statusCode).toBe(401);
    });
  });

  // ==========================================================================
  // POST /ordonnances/{ordonnanceId}/lignes
  // ==========================================================================
  describe('POST /ordonnances/{ordonnanceId}/lignes', () => {
    it('devrait ajouter une ligne de prescription (201)', async () => {
      mockSend.mockImplementation((cmd) => {
        const t = cmd.TableName || '';
        if (cmd.type === 'Get' && t === 'healthtrack-ordonnances') {
          return Promise.resolve({ Item: { ordonnanceId: 'ord-1', patientId: 'pat-1', praticienId: 'prat-1', statut: 'ACTIVE', dateExpiration: new Date(Date.now() + 86400000 * 30).toISOString() } });
        }
        if (cmd.type === 'Get' && t === 'healthtrack-medicaments') {
          return Promise.resolve({ Item: { medicamentId: 'med-1', nom: 'Doliprane' } });
        }
        if (cmd.type === 'Query' || cmd.type === 'Scan') return Promise.resolve({ Items: [] });
        if (cmd.type === 'Put') return Promise.resolve({});
        return Promise.resolve({});
      });

      const event = makeEvent('POST', '/ordonnances/ord-1/lignes', {
        medicamentId: 'med-1',
        posologie: '3 fois par jour',
        duree: '7 jours'
      }, 'praticien-token');

      const result = await handler(event);
      expect(result.statusCode).toBe(201);
    });
  });

  // ==========================================================================
  // GET /ordonnances/{ordonnanceId}/lignes
  // ==========================================================================
  describe('GET /ordonnances/{ordonnanceId}/lignes', () => {
    it('devrait lister les lignes d\'une ordonnance (200)', async () => {
      mockSend.mockImplementation((cmd) => {
        const t = cmd.TableName || '';
        if (cmd.type === 'Get' && t === 'healthtrack-ordonnances') {
          return Promise.resolve({ Item: { ordonnanceId: 'ord-1', patientId: 'pat-1', praticienId: 'prat-1' } });
        }
        if (cmd.type === 'Query' || cmd.type === 'Scan') return Promise.resolve({ Items: [{ ligneId: 'l1', medicamentId: 'med-1' }] });
        return Promise.resolve({});
      });

      const event = makeEvent('GET', '/ordonnances/ord-1/lignes', null, 'praticien-token');
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  // ==========================================================================
  // DELETE /ordonnances/{ordonnanceId}/lignes/{ligneId}
  // ==========================================================================
  describe('DELETE /ordonnances/{ordonnanceId}/lignes/{ligneId}', () => {
    it('devrait supprimer une ligne (204)', async () => {
      mockSend.mockImplementation((cmd) => {
        const t = cmd.TableName || '';
        if (cmd.type === 'Get' && t === 'healthtrack-lignes-prescription') {
          return Promise.resolve({ Item: { ligneId: 'l1', ordonnanceId: 'ord-1' } });
        }
        if (cmd.type === 'Get' && t === 'healthtrack-ordonnances') {
          return Promise.resolve({ Item: { ordonnanceId: 'ord-1', praticienId: 'prat-1', statut: 'ACTIVE', dateExpiration: new Date(Date.now() + 86400000 * 30).toISOString() } });
        }
        return Promise.resolve({});
      });

      const event = makeEvent('DELETE', '/ordonnances/ord-1/lignes/l1', null, 'praticien-token');
      const result = await handler(event);

      expect([200, 204]).toContain(result.statusCode);
    });
  });

  // ==========================================================================
  // GET /medicaments
  // ==========================================================================
  describe('GET /medicaments', () => {
    it('devrait lister les médicaments (200)', async () => {
      mockSend.mockResolvedValue({ Items: [{ medicamentId: 'med-1', nom: 'Doliprane' }], Count: 1 });

      const event = makeEvent('GET', '/medicaments', null, 'patient-token', { page: '1', limit: '10' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.items).toHaveLength(1);
    });
  });

  // ==========================================================================
  // POST /medicaments
  // ==========================================================================
  describe('POST /medicaments', () => {
    it('devrait créer un médicament si admin (201)', async () => {
      mockSend.mockResolvedValue({});

      const event = makeEvent('POST', '/medicaments', {
        nom: 'Doliprane',
        forme: 'COMPRIME',
        dosage: '500mg'
      }, 'admin-token');

      const result = await handler(event);
      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.medicamentId).toBe('mock-uuid-1234');
    });

    it('devrait retourner 403 si non admin', async () => {
      const event = makeEvent('POST', '/medicaments', { nom: 'Doliprane' }, 'praticien-token');
      const result = await handler(event);
      expect(result.statusCode).toBe(403);
    });
  });

  // ==========================================================================
  // Route inconnue
  // ==========================================================================
  describe('Route inconnue', () => {
    it('devrait retourner 404', async () => {
      const event = makeEvent('GET', '/unknown');
      const result = await handler(event);
      expect(result.statusCode).toBe(404);
    });
  });
});
