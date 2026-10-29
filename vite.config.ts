import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [reactRouter()],
  // The front is reached on the LAN by its mDNS name as well as by IP (ADR-0002)
  server: { allowedHosts: ['.local'] },
  // Bundled at startup: found on the first visit, Leaflet would make Vite reload the page
  optimizeDeps: { include: ['leaflet'] },
});
