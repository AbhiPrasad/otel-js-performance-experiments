// OpenTelemetry instrumentation setup
// This file should be loaded BEFORE the application code using --import flag

import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  BatchSpanProcessor,
  NoopSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const exporterType = process.env.OTEL_EXPORTER || 'noop';

function createExporter() {
  switch (exporterType) {
    case 'console':
      return new ConsoleSpanExporter();
    case 'otlp-http':
      return new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      });
    case 'noop':
    default:
      return undefined;
  }
}

function createSpanProcessor(exporter: ReturnType<typeof createExporter>) {
  if (!exporter) {
    // NoopSpanProcessor for measuring SDK overhead without export cost
    return new NoopSpanProcessor();
  }

  if (exporterType === 'console') {
    return new SimpleSpanProcessor(exporter);
  }

  // Use batch processor for production-like exporters
  return new BatchSpanProcessor(exporter);
}

const exporter = createExporter();
const spanProcessor = createSpanProcessor(exporter);

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'fastify-benchmark-app',
  }),
  spanProcessor,
  instrumentations: [
    new HttpInstrumentation(),
  ],
});

sdk.start();

console.log(`[OTel] Instrumentation started with exporter: ${exporterType}`);

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('[OTel] SDK shut down successfully'))
    .catch((err) => console.error('[OTel] Error shutting down SDK', err))
    .finally(() => process.exit(0));
});

process.on('SIGINT', () => {
  sdk.shutdown()
    .then(() => console.log('[OTel] SDK shut down successfully'))
    .catch((err) => console.error('[OTel] Error shutting down SDK', err))
    .finally(() => process.exit(0));
});
