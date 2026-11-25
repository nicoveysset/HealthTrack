/**
 * Tests unitaires pour UserService
 * API Utilisateurs - HealthTrack
 *
 * Teste les fonctions du service (pas une classe) :
 * - register, login, getProfile, updateProfile
 * - setMedecinTraitant, updatePraticienStatut, listPraticiens
 */

// Mock du repository
jest.mock('../src/repositories/userRepository', () => ({
  create: jest.fn(),
  getById: jest.fn(),
  getByEmail: jest.fn(),
  emailExists: jest.fn(),
  update: jest.fn(),
  deleteById: jest.fn(),
  list: jest.fn(),
  listPatientsByMedecinTraitant: jest.fn(),
  listPraticiens: jest.fn(),
  count: jest.fn()
}));

// Mock de bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(async (pw) => `hashed-${pw}`),
  compare: jest.fn(async (pw, hash) => hash === `hashed-${pw}`)
}));

// Mock de uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234')
}));

// Mock de jwt
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn(() => ({ sub: 'user-123' }))
}));

const userService = require('../src/services/userService');
const userRepository = require('../src/repositories/userRepository');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // register
  // ==========================================================================
  describe('register', () => {
    it('devrait inscrire un patient avec succès', async () => {
      userRepository.emailExists.mockResolvedValue(false);
      userRepository.create.mockResolvedValue({
        userId: 'mock-uuid-1234',
        email: 'patient@test.com',
        type: 'PATIENT',
        passwordHash: 'hashed-password123'
      });

      const result = await userService.register({
        email: 'patient@test.com',
        password: 'password123',
        type: 'PATIENT',
        firstName: 'Jean',
        lastName: 'Dupont',
        dateNaissance: '1990-01-01',
        nss: '1234567890123'
      });

      expect(result.user.email).toBe('patient@test.com');
      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.passwordHash).toBeUndefined(); // retiré de la réponse
      expect(userRepository.create).toHaveBeenCalled();
    });

    it('devrait inscrire un praticien avec succès', async () => {
      userRepository.emailExists.mockResolvedValue(false);
      userRepository.create.mockResolvedValue({
        userId: 'mock-uuid-1234',
        email: 'dr@test.com',
        type: 'PRATICIEN',
        passwordHash: 'hashed-password123'
      });

      const result = await userService.register({
        email: 'dr@test.com',
        password: 'password123',
        type: 'PRATICIEN',
        firstName: 'Marie',
        lastName: 'Martin',
        specialite: 'Cardiologie',
        rpps: '12345678901'
      });

      expect(result.user.type).toBe('PRATICIEN');
      expect(result.token).toBeDefined();
    });

    it('devrait rejeter si email existe déjà (409)', async () => {
      userRepository.emailExists.mockResolvedValue(true);

      await expect(userService.register({
        email: 'existing@test.com',
        password: 'password123',
        type: 'PATIENT',
        firstName: 'Test',
        lastName: 'User',
        dateNaissance: '1990-01-01',
        nss: '1234567890123'
      })).rejects.toMatchObject({
        error: 'EmailAlreadyUsedException',
        statusCode: 409
      });
    });

    it('devrait rejeter si mot de passe trop court (400)', async () => {
      await expect(userService.register({
        email: 'test@test.com',
        password: 'short',
        type: 'PATIENT',
        firstName: 'Test',
        lastName: 'User',
        dateNaissance: '1990-01-01',
        nss: '1234567890123'
      })).rejects.toMatchObject({
        error: 'ValidationError',
        statusCode: 400
      });
    });

    it('devrait rejeter si praticien sans specialite (400)', async () => {
      await expect(userService.register({
        email: 'dr@test.com',
        password: 'password123',
        type: 'PRATICIEN',
        firstName: 'Marie',
        lastName: 'Martin',
        rpps: '12345678901'
      })).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it('devrait rejeter si patient sans dateNaissance (400)', async () => {
      await expect(userService.register({
        email: 'p@test.com',
        password: 'password123',
        type: 'PATIENT',
        firstName: 'Test',
        lastName: 'User',
        nss: '1234567890123'
      })).rejects.toMatchObject({
        statusCode: 400
      });
    });
  });

  // ==========================================================================
  // login
  // ==========================================================================
  describe('login', () => {
    it('devrait connecter avec des credentials valides', async () => {
      userRepository.getByEmail.mockResolvedValue({
        userId: 'user-1',
        email: 'test@test.com',
        passwordHash: 'hashed-password123',
        type: 'PATIENT'
      });

      const result = await userService.login('test@test.com', 'password123');

      expect(result.user.email).toBe('test@test.com');
      expect(result.token).toBe('mock-jwt-token');
    });

    it('devrait rejeter si email/password manquants (400)', async () => {
      await expect(userService.login('', '')).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it('devrait rejeter si utilisateur non trouvé (401)', async () => {
      userRepository.getByEmail.mockResolvedValue(null);

      await expect(userService.login('unknown@test.com', 'password123')).rejects.toMatchObject({
        statusCode: 401
      });
    });

    it('devrait rejeter si mot de passe incorrect (401)', async () => {
      userRepository.getByEmail.mockResolvedValue({
        userId: 'user-1',
        email: 'test@test.com',
        passwordHash: 'hashed-correctpassword',
        type: 'PATIENT'
      });

      await expect(userService.login('test@test.com', 'wrongpassword')).rejects.toMatchObject({
        statusCode: 401
      });
    });
  });

  // ==========================================================================
  // getProfile
  // ==========================================================================
  describe('getProfile', () => {
    it('devrait retourner le profil utilisateur', async () => {
      userRepository.getById.mockResolvedValue({
        userId: 'user-1',
        email: 'test@test.com',
        passwordHash: 'secret'
      });

      const result = await userService.getProfile('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.passwordHash).toBeUndefined();
    });

    it('devrait rejeter si utilisateur non trouvé (404)', async () => {
      userRepository.getById.mockResolvedValue(null);

      await expect(userService.getProfile('unknown')).rejects.toMatchObject({
        statusCode: 404
      });
    });
  });

  // ==========================================================================
  // updateProfile
  // ==========================================================================
  describe('updateProfile', () => {
    it('devrait mettre à jour le profil', async () => {
      userRepository.getById.mockResolvedValue({ userId: 'user-1', firstName: 'Old' });
      userRepository.update.mockResolvedValue({ userId: 'user-1', firstName: 'New' });

      const result = await userService.updateProfile('user-1', { firstName: 'New' });

      expect(result.firstName).toBe('New');
      expect(userRepository.update).toHaveBeenCalledWith('user-1', expect.objectContaining({
        firstName: 'New'
      }));
    });

    it('devrait rejeter si utilisateur non trouvé (404)', async () => {
      userRepository.getById.mockResolvedValue(null);

      await expect(userService.updateProfile('unknown', { firstName: 'New' })).rejects.toMatchObject({
        statusCode: 404
      });
    });
  });

  // ==========================================================================
  // setMedecinTraitant
  // ==========================================================================
  describe('setMedecinTraitant', () => {
    it('devrait définir le médecin traitant', async () => {
      userRepository.getById.mockResolvedValueOnce({ userId: 'p1', type: 'PATIENT' });
      userRepository.getById.mockResolvedValueOnce({ userId: 'prat1', type: 'PRATICIEN', statut: 'ACTIF' });
      userRepository.update.mockResolvedValue({ userId: 'p1', medecinTraitantId: 'prat1' });

      const result = await userService.setMedecinTraitant('p1', 'prat1');

      expect(result.medecinTraitantId).toBe('prat1');
    });

    it('devrait rejeter si le praticien n\'est pas trouvé (404)', async () => {
      userRepository.getById.mockResolvedValueOnce({ userId: 'p1', type: 'PATIENT' });
      userRepository.getById.mockResolvedValueOnce(null);

      await expect(userService.setMedecinTraitant('p1', 'unknown')).rejects.toMatchObject({
        statusCode: 404
      });
    });
  });

  // ==========================================================================
  // updatePraticienStatut
  // ==========================================================================
  describe('updatePraticienStatut', () => {
    it('devrait changer le statut', async () => {
      userRepository.getById.mockResolvedValue({ userId: 'prat1', type: 'PRATICIEN', statut: 'ACTIF' });
      userRepository.update.mockResolvedValue({ userId: 'prat1', statut: 'EN_CONGE' });

      const result = await userService.updatePraticienStatut('prat1', 'EN_CONGE');

      expect(result.statut).toBe('EN_CONGE');
    });

    it('devrait rejeter si ce n\'est pas un praticien (403)', async () => {
      userRepository.getById.mockResolvedValue({ userId: 'p1', type: 'PATIENT' });

      await expect(userService.updatePraticienStatut('p1', 'EN_CONGE')).rejects.toMatchObject({
        statusCode: 403
      });
    });
  });

  // ==========================================================================
  // listPraticiens
  // ==========================================================================
  describe('listPraticiens', () => {
    it('devrait lister les praticiens avec filtres', async () => {
      userRepository.listPraticiens.mockResolvedValue({
        items: [
          { userId: 'p1', specialite: 'Cardiologie' },
          { userId: 'p2', specialite: 'Cardiologie' }
        ],
        count: 2,
        page: 1,
        limit: 10
      });

      const result = await userService.listPraticiens({ specialite: 'Cardiologie' }, 1, 10);

      expect(result.items).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  // ==========================================================================
  // Fonctions utilitaires
  // ==========================================================================
  describe('generateToken', () => {
    it('devrait générer un token JWT', () => {
      const token = userService.generateToken({ userId: 'u1', email: 't@t.com', type: 'PATIENT' });
      expect(token).toBe('mock-jwt-token');
    });
  });

  describe('hashPassword / verifyPassword', () => {
    it('devrait hasher et vérifier un mot de passe', async () => {
      const hash = await userService.hashPassword('mypassword');
      expect(hash).toBe('hashed-mypassword');

      const valid = await userService.verifyPassword('mypassword', hash);
      expect(valid).toBe(true);

      const invalid = await userService.verifyPassword('wrong', hash);
      expect(invalid).toBe(false);
    });
  });
});
