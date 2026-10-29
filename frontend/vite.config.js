import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        explorer: './explorer.html',
        workspace: './workspace.html',
        catalog: './catalog.html',
        history: './history.html',
        results: './results.html',
        settings: './settings.html'
      }
    }
  }
});
