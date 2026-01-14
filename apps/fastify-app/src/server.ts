import Fastify, { FastifyInstance } from 'fastify';
import { simpleRoutes } from './routes/simple.js';
import { asyncWorkRoutes } from './routes/async-work.js';
import { externalRoutes } from './routes/external.js';
import { spansRoutes } from './routes/spans.js';

export async function createServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // Disable logging for benchmark accuracy
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'healthy', app: 'fastify', otel: process.env.OTEL_ENABLED === 'true' };
  });

  // Register routes
  await fastify.register(simpleRoutes);
  await fastify.register(asyncWorkRoutes);
  await fastify.register(externalRoutes);
  await fastify.register(spansRoutes);

  return fastify;
}
