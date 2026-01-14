import { FastifyInstance } from 'fastify';

export async function simpleRoutes(fastify: FastifyInstance) {
  // Simple JSON response - minimal processing
  fastify.get('/api/simple', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // Simple text response
  fastify.get('/api/text', async () => {
    return 'Hello, World!';
  });

  // POST endpoint for JSON data
  fastify.post<{ Body: object }>('/api/data', async (request) => {
    return { received: true, size: JSON.stringify(request.body).length };
  });
}
