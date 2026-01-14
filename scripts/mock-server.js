#!/usr/bin/env node

/**
 * Simple mock server for external HTTP call testing
 * Responds to all requests with a simple JSON response
 */

import http from 'http';

const PORT = process.env.MOCK_SERVER_PORT || 3001;
const DELAY = parseInt(process.env.MOCK_DELAY || '5', 10);

const server = http.createServer((req, res) => {
  // Simulate network delay
  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      path: req.url,
      timestamp: Date.now(),
    }));
  }, DELAY);
});

server.listen(PORT, () => {
  console.log(`Mock server listening on port ${PORT} (delay: ${DELAY}ms)`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
