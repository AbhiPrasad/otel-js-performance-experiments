import { FastifyInstance } from 'fastify';

export async function asyncWorkRoutes(fastify: FastifyInstance) {
  // Simulated async I/O delay
  fastify.get<{ Params: { delay: string } }>('/api/async/:delay', async (request) => {
    const delay = parseInt(request.params.delay, 10) || 50;
    await new Promise(resolve => setTimeout(resolve, delay));
    return { delayed: delay, timestamp: Date.now() };
  });

  // Light CPU-bound work (fibonacci)
  fastify.get('/api/cpu/light', async () => {
    const fib = (n: number): number => (n <= 1 ? n : fib(n - 1) + fib(n - 2));
    const result = fib(20);
    return { result, type: 'fibonacci-20' };
  });

  // Heavy CPU-bound work
  fastify.get('/api/cpu/heavy', async () => {
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      sum += Math.sqrt(i);
    }
    return { result: sum, type: 'sqrt-sum-1m' };
  });
}
