import { Router } from 'express';
import http from 'http';

const router = Router();

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

// Single external HTTP call
router.get('/external/single', async (_req, res) => {
  try {
    const result = await fetchMock();
    res.json({ external: result });
  } catch (error) {
    res.status(503).json({ error: 'Mock server unavailable' });
  }
});

// Multiple parallel external HTTP calls
router.get('/external/parallel', async (_req, res) => {
  try {
    const results = await Promise.all([
      fetchMock(),
      fetchMock(),
      fetchMock(),
    ]);
    res.json({ results, count: results.length });
  } catch (error) {
    res.status(503).json({ error: 'Mock server unavailable' });
  }
});

// Multiple sequential external HTTP calls
router.get('/external/sequential', async (_req, res) => {
  try {
    const results: string[] = [];
    results.push(await fetchMock());
    results.push(await fetchMock());
    results.push(await fetchMock());
    res.json({ results, count: results.length });
  } catch (error) {
    res.status(503).json({ error: 'Mock server unavailable' });
  }
});

export default router;
