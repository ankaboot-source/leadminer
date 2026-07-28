import express from 'express';
import corsMiddleware from '../../../src/middleware/cors';
import apiRoutes from '../../../src/api';

export function createTestApp() {
  const app = express();
  app.use(corsMiddleware);
  app.use(express.json({ limit: '5mb' }));
  app.use('/', apiRoutes);
  return app;
}

export default createTestApp;
