import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /**
         * Code splitting strategy:
         * - tfjs: TensorFlow.js (~1.7MB) → lazy-loaded on demand
         * - react: React + ReactDOM → loaded immediately (small)
         * - app: Our code → loaded immediately (tiny)
         *
         * This ensures the initial page load is fast (~50KB),
         * and the heavy ML library loads in the background.
         * Critical for Chrome Extension deployment (faster popup open).
         */
        manualChunks(id) {
          if (id.includes('@tensorflow')) {
            return 'tfjs';
          }
          if (id.includes('react-dom') || id.includes('react')) {
            return 'react-vendor';
          }
        }
      }
    }
  }
});
