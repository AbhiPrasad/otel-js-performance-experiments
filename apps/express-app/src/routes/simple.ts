import { Router } from 'express';

const router = Router();

// Simple JSON response - minimal processing
router.get('/simple', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Simple text response
router.get('/text', (_req, res) => {
  res.send('Hello, World!');
});

// POST endpoint for JSON data
router.post('/data', (req, res) => {
  res.json({ received: true, size: JSON.stringify(req.body).length });
});

export default router;
