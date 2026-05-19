import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Bind to all interfaces so the dev server is reachable from other
    // devices on the LAN (real iPhones, iPhone Mirroring, second laptops,
    // etc.). Vite will print a "Network:" URL with your Mac's IP on boot —
    // open that on the phone. localhost:5173 keeps working unchanged.
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
