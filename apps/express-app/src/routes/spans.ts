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

// Complex attributes to exercise toAnyValue serialization
const COMPLEX_ATTRIBUTES = {
  // Nested object
  'request.metadata': {
    contentType: 'application/json',
    requestId: 'req-12345-abcde',
    client: {
      name: 'benchmark-client',
      version: '1.0.0',
    },
  },
  // Array of primitives
  'user.tags': ['premium', 'verified', 'active', 'beta-tester'],
  // Array of objects
  'cart.items': [
    { id: 1, name: 'Widget A', price: 10.5, quantity: 2 },
    { id: 2, name: 'Widget B', price: 20.0, quantity: 1 },
    { id: 3, name: 'Widget C', price: 15.75, quantity: 3 },
  ],
  // Deeply nested structure
  'analytics.context': {
    session: {
      id: 'sess-98765',
      startedAt: '2024-01-15T10:30:00Z',
      pageViews: 12,
    },
    experiments: [
      { name: 'checkout-v2', variant: 'treatment', enrolled: true },
      { name: 'new-header', variant: 'control', enrolled: false },
    ],
    device: {
      type: 'desktop',
      browser: { name: 'Chrome', version: '120.0' },
      os: { name: 'macOS', version: '14.2' },
    },
  },
  // Simple attributes for comparison
  'http.method': 'GET',
  'http.status_code': 200,
  'service.version': '2.1.0',
};

// Endpoint that creates spans with complex attributes (for toAnyValue benchmarking)
router.get('/spans/complex-attributes', async (_req, res) => {
  const tracer = await getTracer();

  if (!tracer) {
    await simulateWork();
    res.json({ spans: 0, message: 'OTel not enabled' });
    return;
  }

  await tracer.startActiveSpan('complex-attributes-span', async (span) => {
    // Set all complex attributes
    span.setAttributes(COMPLEX_ATTRIBUTES as any);
    await new Promise(resolve => setTimeout(resolve, 1));
    span.end();
  });

  res.json({ spans: 1, attributeTypes: ['nested-object', 'array-primitives', 'array-objects', 'deep-nested'] });
});

export default router;
