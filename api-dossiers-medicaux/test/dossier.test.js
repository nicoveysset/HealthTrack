/**
 * Tests unitaires pour le handler Dossier Médical
 * API Dossiers Médicaux - HealthTrack
 *
 * Le handler utilise directement DynamoDB, on mock les SDK AWS.
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
    throw new Error('invalid');
  })
}));

const { handler } = require('../src/handlers/dossier');

const makeEvent = (method, path, body = null, token = 'patient-token', query = null) => {
  const event = {
    httpMethod: method,
    path: path,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    queryStringParameters: query
  };
  if (body) event.body = JSON.stringify(body);
  return event;
};

// Helper: configure mockSend pour retourner un dossier existant
const mockDossierExistant = () => {
  // Par défaut, retourner un Item pour Get et des Items pour Query/Scan
  mockSend.mockImplementation((cmd) => {
    if (cmd.type === 'Get') return Promise.resolve({ Item: { dossierId: 'pat-1', patientId: 'pat-1' } });
    if (cmd.type === 'Query' || cmd.type === 'Scan') return Promise.resolve({ Items: [{ id: 'mock-1' }] });
    return Promise.resolve({});
  });
};

describe('Dossier Médical Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
  });

  // ==========================================================================
  // GET /patients/{patientId}/dossier
  // ==========================================================================
  describe('GET /patients/{patientId}/dossier', () => {
    it('devrait retourner le dossier complet du patient (200)', async () => {
      mockDossierExistant();

      const event = makeEvent('GET', '/patients/pat-1/dossier');
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.dossier).toBeDefined();
      expect(body.antecedents).toBeDefined();
      expect(body.allergies).toBeDefined();
      expect(body.vaccinations).toBeDefined();
    });

    it('devrait retourner 401 sans token', async () => {
      const event = makeEvent('GET', '/patients/pat-1/dossier', null, null);
      const result = await handler(event);
      expect(result.statusCode).toBe(401);
    });
  });

  // ==========================================================================
  // POST /dossiers/{dossierId}/antecedents
  // ==========================================================================
  describe('POST /dossiers/{dossierId}/antecedents', () => {
    it('devrait créer un antécédent (201)', async () => {
      mockDossierExistant();

      const event = makeEvent('POST', '/dossiers/pat-1/antecedents', {
        type: 'CHRONIQUE',
        description: 'Hypertension',
        dateDebut: '2020-01-01'
      });

      const result = await handler(event);
      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.antecedentId).toBe('mock-uuid-1234');
    });

    it('devrait créer un antécédent même avec champs partiels (201)', async () => {
      mockDossierExistant();

      const event = makeEvent('POST', '/dossiers/pat-1/antecedents', { type: 'CHRONIQUE' });
      const result = await handler(event);
      expect(result.statusCode).toBe(201);
    });
  });

  // ==========================================================================
  // GET /patients/{patientId}/antecedents
  // ==========================================================================
  describe('GET /patients/{patientId}/antecedents', () => {
    it('devrait lister les antécédents (200)', async () => {
      mockSend.mockResolvedValue({ Items: [{ antecedentId: 'a1', description: 'Asthme' }] });

      const event = makeEvent('GET', '/patients/pat-1/antecedents');
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  // ==========================================================================
  // POST /dossiers/{dossierId}/allergies
  // ==========================================================================
  describe('POST /dossiers/{dossierId}/allergies', () => {
    it('devrait créer une allergie (201)', async () => {
      mockDossierExistant();

      const event = makeEvent('POST', '/dossiers/pat-1/allergies', {
        nom: 'Pénicilline',
        severite: 'SEVERE'
      });

      const result = await handler(event);
      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.allergieId).toBe('mock-uuid-1234');
    });

    it('devrait créer une allergie même avec champs partiels (201)', async () => {
      mockDossierExistant();

      const event = makeEvent('POST', '/dossiers/pat-1/allergies', { severite: 'SEVERE' });
      const result = await handler(event);
      expect(result.statusCode).toBe(201);
    });
  });

  // ==========================================================================
  // GET /patients/{patientId}/allergies
  // ==========================================================================
  describe('GET /patients/{patientId}/allergies', () => {
    it('devrait lister les allergies (200)', async () => {
      mockSend.mockResolvedValue({ Items: [{ allergieId: 'al1', nom: 'Pénicilline' }] });

      const event = makeEvent('GET', '/patients/pat-1/allergies');
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  // ==========================================================================
  // DELETE /allergies/{allergieId}
  // ==========================================================================
  describe('DELETE /allergies/{allergieId}', () => {
    it('devrait supprimer une allergie (204)', async () => {
      // getAllergieById → existe, isAllergieLinked → false, delete → ok
      mockSend.mockImplementation((cmd) => {
        if (cmd.type === 'Get') return Promise.resolve({ Item: { allergieId: 'al1', dossierId: 'pat-1' } });
        if (cmd.type === 'Query' || cmd.type === 'Scan') return Promise.resolve({ Items: [] });
        return Promise.resolve({});
      });

      const event = makeEvent('DELETE', '/allergies/al1');
      const result = await handler(event);

      expect(result.statusCode).toBe(204);
    });
  });

  // ==========================================================================
  // POST /dossiers/{dossierId}/vaccinations
  // ==========================================================================
  describe('POST /dossiers/{dossierId}/vaccinations', () => {
    it('devrait créer une vaccination (201)', async () => {
      mockDossierExistant();

      const event = makeEvent('POST', '/dossiers/pat-1/vaccinations', {
        vaccin: 'DTC',
        dateAdministration: '2023-01-15',
        lot: 'LOT123'
      });

      const result = await handler(event);
      expect(result.statusCode).toBe(201);
    });
  });

  // ==========================================================================
  // GET /patients/{patientId}/vaccinations
  // ==========================================================================
  describe('GET /patients/{patientId}/vaccinations', () => {
    it('devrait lister les vaccinations (200)', async () => {
      mockSend.mockResolvedValue({ Items: [{ vaccinationId: 'v1', vaccin: 'DTC' }] });

      const event = makeEvent('GET', '/patients/pat-1/vaccinations');
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  // ==========================================================================
  // PATCH /antecedents/{antecedentId}
  // ==========================================================================
  describe('PATCH /antecedents/{antecedentId}', () => {
    it('devrait mettre à jour un antécédent (200)', async () => {
      mockSend.mockImplementation((cmd) => {
        if (cmd.type === 'Get') return Promise.resolve({ Item: { antecedentId: 'a1', dossierId: 'pat-1' } });
        if (cmd.type === 'Update') return Promise.resolve({ Attributes: { antecedentId: 'a1', description: 'Updated' } });
        return Promise.resolve({});
      });

      const event = makeEvent('PATCH', '/antecedents/a1', { description: 'Updated' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });
  });

  // ==========================================================================
  // POST /antecedents/{antecedentId}/archiver
  // ==========================================================================
  describe('POST /antecedents/{antecedentId}/archiver', () => {
    it('devrait archiver un antécédent (200)', async () => {
      mockSend.mockImplementation((cmd) => {
        if (cmd.type === 'Get') return Promise.resolve({ Item: { antecedentId: 'a1', dossierId: 'pat-1', type: 'PONCTUEL' } });
        if (cmd.type === 'Update') return Promise.resolve({ Attributes: { antecedentId: 'a1', statut: 'ARCHIVE' } });
        return Promise.resolve({});
      });

      const event = makeEvent('POST', '/antecedents/a1/archiver');
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
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
