import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['ccp.orb.local'],
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        // Dev stand-in for the auth proxy (TinyAuth): inject the identity
        // headers the API trusts. In production the proxy sets these.
        headers: {
          'Remote-User': 'tbird',
          'Remote-Name': 'Taylor',
        },
      },
    },
  }
});
