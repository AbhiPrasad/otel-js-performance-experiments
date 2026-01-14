import { Router } from 'express';

const router = Router();

// Simulated async I/O delay
router.get('/async/:delay', async (req, res) => {
  const delay = parseInt(req.params.delay, 10) || 50;
  await new Promise(resolve => setTimeout(resolve, delay));
  res.json({ delayed: delay, timestamp: Date.now() });
});

// Light CPU-bound work (fibonacci)
router.get('/cpu/light', (_req, res) => {
  const fib = (n: number): number => (n <= 1 ? n : fib(n - 1) + fib(n - 2));
  const result = fib(20);
  res.json({ result, type: 'fibonacci-20' });
});

// Heavy CPU-bound work
router.get('/cpu/heavy', (_req, res) => {
  let sum = 0;
  for (let i = 0; i < 1000000; i++) {
    sum += Math.sqrt(i);
  }
  res.json({ result: sum, type: 'sqrt-sum-1m' });
});

export default router;
