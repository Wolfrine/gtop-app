import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('../dist/plant-preview/browser/', import.meta.url)),
  publicDir: fileURLToPath(new URL('./visual-review/', import.meta.url)),
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
  optimizeDeps: { noDiscovery: true, include: [] },
});
