/** @type {import('vite').UserConfig} */
// En développement local, le proxy redirige /api-xxx vers les 4 APIs Spring Boot
// (ports 8081 à 8084) en retirant le préfixe. En production (S3), config.js contient
// directement les URLs API Gateway et ce proxy n'est pas utilisé.
const api = (port, prefix) => ({
  target: `http://localhost:${port}`,
  changeOrigin: true,
  rewrite: (path) => path.replace(new RegExp(`^${prefix}`), '')
});

export default {
  plugins: [
    require('@vitejs/plugin-react')()
  ],
  server: {
    port: 3000,
    proxy: {
      '/api-utilisateurs': api(8081, '/api-utilisateurs'),
      '/api-rdv': api(8082, '/api-rdv'),
      '/api-dossiers': api(8083, '/api-dossiers'),
      '/api-ordonnances': api(8084, '/api-ordonnances')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
};
