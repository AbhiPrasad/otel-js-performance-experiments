import { createServer } from './server.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start() {
  const fastify = await createServer();

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Fastify app listening on port ${PORT}`);
    console.log(`OpenTelemetry enabled: ${process.env.OTEL_ENABLED === 'true'}`);
    console.log(`Exporter: ${process.env.OTEL_EXPORTER || 'none'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    await fastify.close();
    console.log('Server closed');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start();
