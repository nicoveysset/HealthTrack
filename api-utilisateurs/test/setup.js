/**
 * Setup Jest pour l'API Utilisateurs
 */

// Configuration de l'environnement Node
process.env.NODE_ENV = 'test';

// Mock des variables d'environnement AWS
process.env.DYNAMODB_REGION = 'eu-west-1';
process.env.JWT_SECRET = 'test-secret-key';
process.env.TABLE_NAME = 'healthtrack-utilisateurs';

// Mock global pour les erreurs non gérées
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Configuration pour éviter les warnings de date
process.env.TZ = 'UTC';
