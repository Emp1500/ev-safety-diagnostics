import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // sockjs-client is a legacy CommonJS bundle that references Node's `global`.
  // This tells Vite to replace `global` with `globalThis` so it works in browsers.
  define: {
    global: 'globalThis',
  },

  server: {
    port: 5173,
    proxy: {
      // All /api/* calls forwarded to Spring Boot REST API
      // Using Windows host IP (172.23.112.1) because Spring Boot runs on Windows,
      // not inside WSL where the Vite dev server lives.
      '/api': {
        target: 'http://172.23.112.1:8080',
        changeOrigin: true,
      },
      // WebSocket (SockJS + STOMP) forwarded to Spring Boot /ws
      '/ws': {
        target: 'http://172.23.112.1:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },

  build: {
    // Output to dist/ — copy this folder into Spring Boot's
    // src/main/resources/static/ for a fully combined single-JAR deployment.
    outDir: 'dist',
    emptyOutDir: true,
  },
});
