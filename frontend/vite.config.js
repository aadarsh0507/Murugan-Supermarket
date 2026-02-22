import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000/',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('⚠️  Backend server not running. Please start the backend server on port 5000.');
            console.log('   Run: cd backend && pnpm dev');
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log(`→ ${req.method} ${req.url}`);
          });
        },
      },
      '/uploads': {
        target: 'http://localhost:5000/',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // Silently handle upload proxy errors
          });
        },
      }
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['recharts'],
    exclude: [],
  },
}));
