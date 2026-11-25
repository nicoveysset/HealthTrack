/**
 * Tests unitaires pour UserRepository
 * API Utilisateurs - HealthTrack
 *
 * Teste les fonctions du repository (pas une classe) avec DynamoDB mocké.
 */

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

const mockSend = jest.fn();
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

const userRepository = require('../src/repositories/userRepository');

describe('UserRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // create
  // ==========================================================================
  describe('create', () => {
    it('devrait créer un utilisateur', async () => {
      mockSend.mockResolvedValue({});

      const user = { userId: 'u1', email: 'test@test.com' };
      const result = await userRepository.create(user);

      expect(result).toEqual(user);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // getById
  // ==========================================================================
  describe('getById', () => {
    it('devrait retourner un utilisateur par son ID', async () => {
      mockSend.mockResolvedValue({ Item: { userId: 'u1', email: 'test@test.com' } });

      const result = await userRepository.getById('u1');

      expect(result.userId).toBe('u1');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('devrait retourner null si non trouvé', async () => {
      mockSend.mockResolvedValue({});

      const result = await userRepository.getById('unknown');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getByEmail
  // ==========================================================================
  describe('getByEmail', () => {
    it('devrait retourner un utilisateur par email', async () => {
      mockSend.mockResolvedValue({ Items: [{ userId: 'u1', email: 'test@test.com' }] });

      const result = await userRepository.getByEmail('test@test.com');

      expect(result.email).toBe('test@test.com');
    });

    it('devrait retourner undefined si email non trouvé', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await userRepository.getByEmail('unknown@test.com');

      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // emailExists
  // ==========================================================================
  describe('emailExists', () => {
    it('devrait retourner true si email existe', async () => {
      mockSend.mockResolvedValue({ Items: [{ userId: 'u1' }] });

      const result = await userRepository.emailExists('test@test.com');

      expect(result).toBe(true);
    });

    it('devrait retourner false si email n\'existe pas', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await userRepository.emailExists('unknown@test.com');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // update
  // ==========================================================================
  describe('update', () => {
    it('devrait mettre à jour un utilisateur', async () => {
      mockSend.mockResolvedValue({
        Attributes: { userId: 'u1', firstName: 'Updated' }
      });

      const result = await userRepository.update('u1', { firstName: 'Updated' });

      expect(result.firstName).toBe('Updated');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // deleteById
  // ==========================================================================
  describe('deleteById', () => {
    it('devrait supprimer un utilisateur', async () => {
      mockSend.mockResolvedValue({});

      await userRepository.deleteById('u1');

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // list
  // ==========================================================================
  describe('list', () => {
    it('devrait lister les utilisateurs avec pagination', async () => {
      mockSend.mockResolvedValue({
        Items: [{ userId: 'u1' }, { userId: 'u2' }],
        LastEvaluatedKey: undefined
      });

      const result = await userRepository.list({ limit: 10 });

      expect(result.items).toHaveLength(2);
    });
  });

  // ==========================================================================
  // listPraticiens
  // ==========================================================================
  describe('listPraticiens', () => {
    it('devrait lister les praticiens filtrés par spécialité', async () => {
      mockSend.mockResolvedValue({
        Items: [{ userId: 'p1', specialite: 'Cardiologie' }]
      });

      const result = await userRepository.listPraticiens({ specialite: 'Cardiologie' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].specialite).toBe('Cardiologie');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  // ==========================================================================
  // count
  // ==========================================================================
  describe('count', () => {
    it('devrait compter les utilisateurs', async () => {
      mockSend.mockResolvedValue({ Count: 42 });

      const result = await userRepository.count();

      expect(result).toBe(42);
    });

    it('devrait retourner 0 si aucun résultat', async () => {
      mockSend.mockResolvedValue({});

      const result = await userRepository.count();

      expect(result).toBe(0);
    });
  });
});
