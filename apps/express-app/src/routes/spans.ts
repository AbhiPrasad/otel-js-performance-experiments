import { Router } from 'express';

const router = Router();

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
  return trace?.getTracer('express-benchmark-app');
}

// Endpoint that creates nested manual spans
router.get('/spans/nested', async (_req, res) => {
  const tracer = await getTracer();

  if (!tracer) {
    // No tracer available, just simulate the work
    await simulateWork();
    res.json({ spans: 0, message: 'OTel not enabled' });
    return;
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

  res.json({ spans: 4, structure: 'parent > (child1, child2 > grandchild)' });
});

async function simulateWork() {
  await new Promise(resolve => setTimeout(resolve, 1));
  await new Promise(resolve => setTimeout(resolve, 1));
}

export default router;
