import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Conditional base path for GitHub Pages vs custom domain
  base: process.env.GITHUB_ACTIONS === 'true' ? '/JobBridge/' : '/',
  plugins: [react()],
  optimizeDeps: {
    include: ['lucide-react'],
  },
  build: {
    // Subresource Integrity for production builds
    manifest: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5174,
    host: 'localhost',
    proxy: {
      // Forward API requests to the Express backend server
      '/signup': { target: 'http://localhost:5050', changeOrigin: true },
      '/login': { target: 'http://localhost:5050', changeOrigin: true },
      '/auth': { target: 'http://localhost:5050', changeOrigin: true },
      '/profile': { target: 'http://localhost:5050', changeOrigin: true },
      '/otp': { target: 'http://localhost:5050', changeOrigin: true },
      '/welcome': { target: 'http://localhost:5050', changeOrigin: true },
      '/health': { target: 'http://localhost:5050', changeOrigin: true },
      '/jobs': { target: 'http://localhost:5050', changeOrigin: true },
      '/ai': { target: 'http://localhost:5050', changeOrigin: true },

      '/pay': { target: 'http://localhost:5050', changeOrigin: true },
      '/user': { target: 'http://localhost:5050', changeOrigin: true },
      '/my-applications': { target: 'http://localhost:5050', changeOrigin: true },
      '/recruiter': { target: 'http://localhost:5050', changeOrigin: true },
      '/applications': { target: 'http://localhost:5050', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5050', changeOrigin: true },
      // Forward AI queries to the AI server
      '/api/query': { target: 'http://localhost:5178', changeOrigin: true },
      // Forward other api requests to the Express backend server
      '/api': { target: 'http://localhost:5050', changeOrigin: true },
    },
  },
});
