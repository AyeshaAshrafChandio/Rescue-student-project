import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const getFirebaseCfg = () => ({
    apiKey:
      process.env.VITE_FIREBASE_API_KEY ||
      process.env.FIREBASE_API_KEY ||
      env.VITE_FIREBASE_API_KEY ||
      env.FIREBASE_API_KEY ||
      '',
    authDomain:
      process.env.VITE_FIREBASE_AUTH_DOMAIN ||
      process.env.FIREBASE_AUTH_DOMAIN ||
      env.VITE_FIREBASE_AUTH_DOMAIN ||
      env.FIREBASE_AUTH_DOMAIN ||
      '',
    projectId:
      process.env.VITE_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      env.VITE_FIREBASE_PROJECT_ID ||
      env.FIREBASE_PROJECT_ID ||
      '',
    storageBucket:
      process.env.VITE_FIREBASE_STORAGE_BUCKET ||
      process.env.FIREBASE_STORAGE_BUCKET ||
      env.VITE_FIREBASE_STORAGE_BUCKET ||
      env.FIREBASE_STORAGE_BUCKET ||
      '',
    messagingSenderId:
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      process.env.FIREBASE_MESSAGING_SENDER_ID ||
      env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      env.FIREBASE_MESSAGING_SENDER_ID ||
      '',
    appId:
      process.env.VITE_FIREBASE_APP_ID ||
      process.env.FIREBASE_APP_ID ||
      env.VITE_FIREBASE_APP_ID ||
      env.FIREBASE_APP_ID ||
      '',
  });

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'inject-runtime-firebase-config',
        transformIndexHtml(html) {
          const cfg = getFirebaseCfg();
          const script = `<script>window.__FIREBASE_CONFIG__ = ${JSON.stringify(cfg)};</script>`;
          return html.replace('</head>', `${script}</head>`);
        },
      },
    ],
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(
        process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || ''
      ),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(
        process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || env.VITE_FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN || ''
      ),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(
        process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || ''
      ),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(
        process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET || ''
      ),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.FIREBASE_MESSAGING_SENDER_ID || ''
      ),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(
        process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID || env.FIREBASE_APP_ID || ''
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
