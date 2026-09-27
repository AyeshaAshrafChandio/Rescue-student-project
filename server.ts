import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/routes.ts';
import {
  ensureFirebaseAuthorizedDomains,
  getPublicFirebaseClientConfig,
} from './src/lib/firebase-admin.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoints for Cloud Run startup/liveness probes
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', apiRouter);

const distPath = path.join(__dirname, 'dist');
const indexHtmlPath = path.join(distPath, 'index.html');
const isDev = process.env.DEV_SERVER === 'true' || !fs.existsSync(indexHtmlPath);

function serveIndexHtmlWithRuntimeConfig(res: express.Response) {
  try {
    const rawHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    const firebaseCfg = getPublicFirebaseClientConfig();
    const scriptTag = `<script>window.__FIREBASE_CONFIG__ = ${JSON.stringify(firebaseCfg)};</script>`;
    const injected = rawHtml.includes('</head>')
      ? rawHtml.replace('</head>', `${scriptTag}</head>`)
      : `${scriptTag}${rawHtml}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(injected);
  } catch {
    res.sendFile(indexHtmlPath);
  }
}

if (!isDev && fs.existsSync(indexHtmlPath)) {
  // Serve pre-built static frontend in production (injecting runtime Firebase config on index.html)
  app.use(express.static(distPath, { index: false }));
  app.get('*', (req, res) => {
    if (req.hostname) {
      void ensureFirebaseAuthorizedDomains([req.hostname]);
    }
    serveIndexHtmlWithRuntimeConfig(res);
  });
} else {
  // In development (or if dist is not built yet), delegate non-API routes to Vite middleware
  let viteMiddleware: any = null;

  app.use((req, res, next) => {
    if (req.hostname) {
      void ensureFirebaseAuthorizedDomains([req.hostname]);
    }
    if (viteMiddleware) {
      return viteMiddleware(req, res, next);
    }
    if (fs.existsSync(indexHtmlPath)) {
      return express.static(distPath, { index: false })(req, res, () => {
        serveIndexHtmlWithRuntimeConfig(res);
      });
    }
    res.status(200).send('Starting Student Project Rescue server...');
  });

  import('vite')
    .then(async ({ createServer: createViteServer }) => {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      viteMiddleware = vite.middlewares;
    })
    .catch((err) => {
      console.error('Failed to initialize Vite dev middleware:', err);
    });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Student Project Rescue server listening on http://0.0.0.0:${port}`);
  // Ensure rescue-student-project.ai.studio and preview/shared Cloud Run domains are authorized in Firebase
  void ensureFirebaseAuthorizedDomains([
    'rescue-student-project.ai.studio',
    'ais-dev-y4kayahvn4anycfy5kcoiw-182311365379.asia-east1.run.app',
    'ais-pre-y4kayahvn4anycfy5kcoiw-182311365379.asia-east1.run.app',
  ]);
});
