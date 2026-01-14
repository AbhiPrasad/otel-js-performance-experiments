import { createServer } from './server.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = createServer();

const server = app.listen(PORT, () => {
  console.log(`Express app listening on port ${PORT}`);
  console.log(`OpenTelemetry enabled: ${process.env.OTEL_ENABLED === 'true'}`);
  console.log(`Exporter: ${process.env.OTEL_EXPORTER || 'none'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
