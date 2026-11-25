/**
 * Tests unitaires pour le handler Auth
 * API Utilisateurs - HealthTrack
 *
 * Teste le handler avec les routes réelles :
 * - POST /auth/register
 * - POST /auth/login
 * - GET /utilisateurs/me
 * - PATCH /utilisateurs/me
 * - PUT /patients/me/medecin-traitant
 * - PATCH /praticiens/me/statut
 * - GET /praticiens
 */

// Mock du service (fonctions, pas classe)
jest.mock('../src/services/userService', () => ({
  register: jest.fn(),
  login: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  setMedecinTraitant: jest.fn(),
  updatePraticienStatut: jest.fn(),
  listPraticiens: jest.fn()
}));

// Mock de jwt
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn((token) => {
    if (token === 'valid-patient-token') {
      return { sub: 'patient-123', email: 'patient@test.com', type: 'PATIENT' };
    }
    if (token === 'valid-praticien-token') {
      return { sub: 'praticien-456', email: 'dr@test.com', type: 'PRATICIEN' };
    }
    throw new Error('invalid token');
  })
}));

const { handler } = require('../src/handlers/auth');
const userService = require('../src/services/userService');

// Helper pour créer un event avec token JWT
const makeEvent = (method, path, body = null, token = null, query = null) => {
  const event = {
    httpMethod: method,
    path: path,
    headers: {},
    queryStringParameters: query
  };
  if (token) {
    event.headers.Authorization = `Bearer ${token}`;
  }
  if (body) {
    event.body = JSON.stringify(body);
  }
  return event;
};

describe('Auth Handler - API Utilisateurs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // POST /auth/register
  // ==========================================================================
  describe('POST /auth/register', () => {
    it('devrait créer un patient avec succès (201)', async () => {
      const event = makeEvent('POST', '/auth/register', {
        email: 'patient@test.com',
        password: 'password123',
        type: 'PATIENT',
        firstName: 'Jean',
        lastName: 'Dupont',
        dateNaissance: '1990-01-01',
        nss: '1234567890123'
      });

      userService.register.mockResolvedValue({
        user: { userId: 'user-1', email: 'patient@test.com', type: 'PATIENT' },
        token: 'mock-jwt-token'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.user.email).toBe('patient@test.com');
      expect(body.token).toBe('mock-jwt-token');
      expect(userService.register).toHaveBeenCalledWith(expect.objectContaining({
        email: 'patient@test.com',
        type: 'PATIENT'
      }));
    });

    it('devrait créer un praticien avec succès (201)', async () => {
      const event = makeEvent('POST', '/auth/register', {
        email: 'dr@test.com',
        password: 'password123',
        type: 'PRATICIEN',
        firstName: 'Marie',
        lastName: 'Martin',
        specialite: 'Cardiologie',
        rpps: '12345678901'
      });

      userService.register.mockResolvedValue({
        user: { userId: 'user-2', email: 'dr@test.com', type: 'PRATICIEN' },
        token: 'mock-jwt-token'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      expect(userService.register).toHaveBeenCalled();
    });

    it('devrait retourner 400 si données invalides', async () => {
      const event = makeEvent('POST', '/auth/register', {
        email: 'invalid-email'
      });

      userService.register.mockRejectedValue({
        error: 'ValidationError',
        message: 'password est requis',
        statusCode: 400
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('ValidationError');
    });

    it('devrait retourner 409 si email déjà utilisé', async () => {
      const event = makeEvent('POST', '/auth/register', {
        email: 'existing@test.com',
        password: 'password123',
        type: 'PATIENT',
        firstName: 'Test',
        lastName: 'User',
        dateNaissance: '1990-01-01',
        nss: '1234567890123'
      });

      userService.register.mockRejectedValue({
        error: 'EmailAlreadyUsedException',
        message: 'Un utilisateur avec cet email existe déjà',
        statusCode: 409
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('EmailAlreadyUsedException');
    });
  });

  // ==========================================================================
  // POST /auth/login
  // ==========================================================================
  describe('POST /auth/login', () => {
    it('devrait connecter un utilisateur avec succès (200)', async () => {
      const event = makeEvent('POST', '/auth/login', {
        email: 'patient@test.com',
        password: 'password123'
      });

      userService.login.mockResolvedValue({
        user: { userId: 'user-1', email: 'patient@test.com' },
        token: 'mock-jwt-token'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.token).toBe('mock-jwt-token');
      expect(userService.login).toHaveBeenCalledWith('patient@test.com', 'password123');
    });

    it('devrait retourner 400 si email/password manquants', async () => {
      const event = makeEvent('POST', '/auth/login', { email: 'test@test.com' });

      userService.login.mockRejectedValue({
        error: 'ValidationError',
        message: 'email et password sont requis',
        statusCode: 400
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('devrait retourner 401 si credentials invalides', async () => {
      const event = makeEvent('POST', '/auth/login', {
        email: 'test@test.com',
        password: 'wrongpassword'
      });

      userService.login.mockRejectedValue({
        error: 'Unauthorized',
        message: 'Email ou mot de passe incorrect',
        statusCode: 401
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  // ==========================================================================
  // GET /utilisateurs/me
  // ==========================================================================
  describe('GET /utilisateurs/me', () => {
    it('devrait retourner le profil de l\'utilisateur connecté (200)', async () => {
      const event = makeEvent('GET', '/utilisateurs/me', null, 'valid-patient-token');

      userService.getProfile.mockResolvedValue({
        userId: 'patient-123',
        email: 'patient@test.com',
        type: 'PATIENT'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.userId).toBe('patient-123');
      expect(userService.getProfile).toHaveBeenCalledWith('patient-123');
    });

    it('devrait retourner 401 sans token', async () => {
      const event = makeEvent('GET', '/utilisateurs/me');

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      expect(userService.getProfile).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // PATCH /utilisateurs/me
  // ==========================================================================
  describe('PATCH /utilisateurs/me', () => {
    it('devrait mettre à jour le profil (200)', async () => {
      const event = makeEvent('PATCH', '/utilisateurs/me', {
        firstName: 'Jean',
        lastName: 'Dupont-Martin'
      }, 'valid-patient-token');

      userService.updateProfile.mockResolvedValue({
        userId: 'patient-123',
        firstName: 'Jean',
        lastName: 'Dupont-Martin'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.lastName).toBe('Dupont-Martin');
      expect(userService.updateProfile).toHaveBeenCalledWith('patient-123', expect.objectContaining({
        firstName: 'Jean'
      }));
    });

    it('devrait retourner 401 sans token', async () => {
      const event = makeEvent('PATCH', '/utilisateurs/me', { firstName: 'Test' });

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  // ==========================================================================
  // PUT /patients/me/medecin-traitant
  // ==========================================================================
  describe('PUT /patients/me/medecin-traitant', () => {
    it('devrait définir le médecin traitant (200)', async () => {
      const event = makeEvent('PUT', '/patients/me/medecin-traitant', {
        medecinTraitantId: 'praticien-456'
      }, 'valid-patient-token');

      userService.setMedecinTraitant.mockResolvedValue({
        userId: 'patient-123',
        medecinTraitantId: 'praticien-456'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(userService.setMedecinTraitant).toHaveBeenCalledWith('patient-123', 'praticien-456');
    });

    it('devrait retourner 403 si ce n\'est pas un patient', async () => {
      const event = makeEvent('PUT', '/patients/me/medecin-traitant', {
        medecinTraitantId: 'praticien-456'
      }, 'valid-praticien-token');

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      expect(userService.setMedecinTraitant).not.toHaveBeenCalled();
    });

    it('devrait retourner 400 si medecinTraitantId manquant', async () => {
      const event = makeEvent('PUT', '/patients/me/medecin-traitant', {}, 'valid-patient-token');

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  // ==========================================================================
  // PATCH /praticiens/me/statut
  // ==========================================================================
  describe('PATCH /praticiens/me/statut', () => {
    it('devrait changer le statut du praticien (200)', async () => {
      const event = makeEvent('PATCH', '/praticiens/me/statut', {
        statut: 'EN_CONGE'
      }, 'valid-praticien-token');

      userService.updatePraticienStatut.mockResolvedValue({
        userId: 'praticien-456',
        statut: 'EN_CONGE'
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.statut).toBe('EN_CONGE');
    });

    it('devrait retourner 403 si ce n\'est pas un praticien', async () => {
      const event = makeEvent('PATCH', '/praticiens/me/statut', {
        statut: 'EN_CONGE'
      }, 'valid-patient-token');

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
    });

    it('devrait retourner 400 si statut manquant', async () => {
      const event = makeEvent('PATCH', '/praticiens/me/statut', {}, 'valid-praticien-token');

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  // ==========================================================================
  // GET /praticiens
  // ==========================================================================
  describe('GET /praticiens', () => {
    it('devrait lister les praticiens avec pagination (200)', async () => {
      const event = makeEvent('GET', '/praticiens', null, null, {
        specialite: 'Cardiologie',
        page: '1',
        limit: '10'
      });

      userService.listPraticiens.mockResolvedValue({
        items: [{ userId: 'p1', specialite: 'Cardiologie' }],
        count: 1,
        page: 1,
        limit: 10
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.items).toHaveLength(1);
      expect(userService.listPraticiens).toHaveBeenCalledWith(
        { specialite: 'Cardiologie' },
        1,
        10
      );
    });

    it('devrait utiliser les valeurs par défaut pour la pagination', async () => {
      const event = makeEvent('GET', '/praticiens');

      userService.listPraticiens.mockResolvedValue({ items: [], count: 0, page: 1, limit: 10 });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(userService.listPraticiens).toHaveBeenCalledWith({}, 1, 10);
    });
  });

  // ==========================================================================
  // Route inconnue
  // ==========================================================================
  describe('Route inconnue', () => {
    it('devrait retourner 404 pour une route inexistante', async () => {
      const event = makeEvent('GET', '/route-inexistante');

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('NotFound');
    });
  });

  // ==========================================================================
  // Erreur interne
  // ==========================================================================
  describe('Gestion des erreurs', () => {
    it('devrait retourner 500 pour une erreur interne non gérée', async () => {
      const event = makeEvent('POST', '/auth/login', {
        email: 'test@test.com',
        password: 'password123'
      });

      userService.login.mockRejectedValue(new Error('DynamoDB connection failed'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('InternalServerError');
    });
  });
});
