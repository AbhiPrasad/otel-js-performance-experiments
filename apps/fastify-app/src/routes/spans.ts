import { FastifyInstance } from 'fastify';

// Dynamically import OpenTelemetry API if available
let trace: typeof import('@opentelemetry/api').trace | null = null;

async function getTracer() {
  if (trace === null) {
    try {
      const api = await import('@opentelemetry/api');
      trace = api.trace;
    } catch {
      // OpenTelemetry not available
    }
  }
  return trace?.getTracer('fastify-benchmark-app');
}

async function simulateWork() {
  await new Promise(resolve => setTimeout(resolve, 1));
  await new Promise(resolve => setTimeout(resolve, 1));
}

export async function spansRoutes(fastify: FastifyInstance) {
  // Endpoint that creates nested manual spans
  fastify.get('/api/spans/nested', async () => {
    const tracer = await getTracer();

    if (!tracer) {
      // No tracer available, just simulate the work
      await simulateWork();
      return { spans: 0, message: 'OTel not enabled' };
    }

    // Create nested spans
    await tracer.startActiveSpan('parent-span', async (parentSpan) => {
      await tracer.startActiveSpan('child-span-1', async (childSpan1) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        childSpan1.end();
      });

      await tracer.startActiveSpan('child-span-2', async (childSpan2) => {
        await tracer.startActiveSpan('grandchild-span', async (grandchildSpan) => {
          await new Promise(resolve => setTimeout(resolve, 1));
          grandchildSpan.end();
        });
        childSpan2.end();
      });

      parentSpan.end();
    });

    return { spans: 4, structure: 'parent > (child1, child2 > grandchild)' };
  });
}
