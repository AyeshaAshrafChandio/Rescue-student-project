import type { Plugin } from 'vite';
import express from 'express';
import { apiRouter } from './routes.ts';

export function studentRescueApiPlugin(): Plugin {
  return {
    name: 'student-rescue-api-plugin',
    configureServer(server) {
      const app = express();
      app.use(express.json({ limit: '50mb' }));
      app.use(express.urlencoded({ extended: true, limit: '50mb' }));

      // Health endpoint
      app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      });

      // Mount routes
      app.use('/api', apiRouter);

      // Connect express to Vite dev server
      server.middlewares.use(app);
    },
  };
}
