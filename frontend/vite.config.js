/** @type {import('vite').UserConfig} */
export default {
  plugins: [
    require('@vitejs/plugin-react')()
  ],
  server: {
    port: 3000,
    proxy: {
      // Proxy pour les APIs en développement
      '/api-utilisateurs': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api-rdv': {
        target: 'http://localhost:3002',
        changeOrigin: true
      },
      '/api-dossiers': {
        target: 'http://localhost:3003',
        changeOrigin: true
      },
      '/api-ordonnances': {
        target: 'http://localhost:3004',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
};
