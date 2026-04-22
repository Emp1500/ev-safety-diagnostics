import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

// Dynamically resolve the Windows host IP for WSL2 environments.
// Falls back to localhost for native Linux/Mac or mirrored-mode WSL2.
function getBackendHost() {
  try {
    const gateway = execSync("ip route show | grep default | awk '{print $3}'", { encoding: 'utf8' }).trim();
    if (gateway) return gateway;
  } catch (_) {}
  return 'localhost';
}

const BACKEND_HOST = process.env.BACKEND_HOST || getBackendHost();
const BACKEND_URL = `http://${BACKEND_HOST}:8080`;

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
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/ws': {
        target: BACKEND_URL,
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
