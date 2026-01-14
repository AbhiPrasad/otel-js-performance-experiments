import { FastifyInstance } from 'fastify';
import http from 'http';

const MOCK_SERVER_PORT = process.env.MOCK_SERVER_PORT || 3001;

function fetchMock(): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${MOCK_SERVER_PORT}/mock`, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

export async function externalRoutes(fastify: FastifyInstance) {
  // Single external HTTP call
  fastify.get('/api/external/single', async (_request, reply) => {
    try {
      const result = await fetchMock();
      return { external: result };
    } catch {
      reply.code(503);
      return { error: 'Mock server unavailable' };
    }
  });

  // Multiple parallel external HTTP calls
  fastify.get('/api/external/parallel', async (_request, reply) => {
    try {
      const results = await Promise.all([
        fetchMock(),
        fetchMock(),
        fetchMock(),
      ]);
      return { results, count: results.length };
    } catch {
      reply.code(503);
      return { error: 'Mock server unavailable' };
    }
  });

  // Multiple sequential external HTTP calls
  fastify.get('/api/external/sequential', async (_request, reply) => {
    try {
      const results: string[] = [];
      results.push(await fetchMock());
      results.push(await fetchMock());
      results.push(await fetchMock());
      return { results, count: results.length };
    } catch {
      reply.code(503);
      return { error: 'Mock server unavailable' };
    }
  });
}
