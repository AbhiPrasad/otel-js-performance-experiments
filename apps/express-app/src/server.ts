import express, { Application } from 'express';
import simpleRoutes from './routes/simple.js';
import asyncWorkRoutes from './routes/async-work.js';
import externalRoutes from './routes/external.js';
import spansRoutes from './routes/spans.js';

export function createServer(): Application {
  const app = express();

  // Middleware
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', app: 'express', otel: process.env.OTEL_ENABLED === 'true' });
  });

  // Mount routes
  app.use('/api', simpleRoutes);
  app.use('/api', asyncWorkRoutes);
  app.use('/api', externalRoutes);
  app.use('/api', spansRoutes);

  return app;
}
