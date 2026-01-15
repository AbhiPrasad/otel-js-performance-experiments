import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ResultsStorage } from './storage.js';
import type { BenchmarkResults, StoredBenchmark } from './schema.js';

// Create a temporary directory for testing
let tempDir: string;
let storage: ResultsStorage;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'otel-perf-test-'));
  storage = new ResultsStorage({ resultsDir: tempDir });
  await storage.initialize();
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

// Helper to create minimal benchmark results
function createResults(overrides?: Partial<BenchmarkResults>): BenchmarkResults {
  return {
    autocannon: {
      requestsPerSecond: {
        mean: 1000,
        stddev: 50,
        min: 900,
        max: 1100,
        p50: 1000,
        p90: 1050,
        p99: 1080,
      },
      latency: {
        mean: 10,
        stddev: 2,
        min: 5,
        max: 20,
        p50: 10,
        p90: 15,
        p99: 18,
      },
      throughput: {
        mean: 1000000,
        stddev: 50000,
        min: 900000,
        max: 1100000,
      },
      totalRequests: 30000,
      errors: 0,
      timeouts: 0,
    },
    ...overrides,
  };
}

const defaultConfig = {
  app: 'express',
  scenario: 'simple-json',
  mode: 'baseline',
  connections: 10,
  duration: 30,
  pipelining: 1,
};

describe('ResultsStorage', () => {
  describe('initialize', () => {
    it('should create required directories', async () => {
      const benchmarksDir = path.join(tempDir, 'benchmarks');
      const comparisonsDir = path.join(tempDir, 'comparisons');
      const clinicDir = path.join(tempDir, 'clinic-reports');

      await expect(fs.stat(benchmarksDir)).resolves.toBeDefined();
      await expect(fs.stat(comparisonsDir)).resolves.toBeDefined();
      await expect(fs.stat(clinicDir)).resolves.toBeDefined();
    });
  });

  describe('save', () => {
    it('should save benchmark and return UUID', async () => {
      const results = createResults();
      const id = await storage.save('test-label', results, defaultConfig);

      expect(id).toBeDefined();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should save benchmark with git info', async () => {
      const results = createResults();
      const gitInfo = {
        branch: 'feature/test',
        commit: 'abc123def456',
        commitMessage: 'Test commit',
        commitDate: '2024-01-01',
      };

      const id = await storage.save('test-label', results, defaultConfig, gitInfo);
      const loaded = await storage.loadById(id);

      expect(loaded).not.toBeNull();
      expect(loaded!.metadata.git.branch).toBe('feature/test');
      expect(loaded!.metadata.git.commit).toBe('abc123def456');
      expect(loaded!.metadata.git.shortCommit).toBe('abc123d');
    });

    it('should update index after save', async () => {
      const results = createResults();
      await storage.save('test-label', results, defaultConfig);

      const index = await storage.list();
      expect(index).toHaveLength(1);
      expect(index[0].label).toBe('test-label');
    });
  });

  describe('load', () => {
    it('should load by ID', async () => {
      const results = createResults();
      const id = await storage.save('test-label', results, defaultConfig);

      const loaded = await storage.load(id);

      expect(loaded).not.toBeNull();
      expect(loaded!.metadata.id).toBe(id);
    });

    it('should load by label', async () => {
      const results = createResults();
      await storage.save('test-label', results, defaultConfig);

      const loaded = await storage.load('test-label');

      expect(loaded).not.toBeNull();
      expect(loaded!.metadata.label).toBe('test-label');
    });

    it('should return null for non-existent ID', async () => {
      const loaded = await storage.load('non-existent');
      expect(loaded).toBeNull();
    });
  });

  describe('loadById', () => {
    it('should load benchmark by specific ID', async () => {
      const results = createResults();
      const id = await storage.save('test-label', results, defaultConfig);

      const loaded = await storage.loadById(id);

      expect(loaded).not.toBeNull();
      expect(loaded!.metadata.id).toBe(id);
    });

    it('should return null for non-existent ID', async () => {
      const loaded = await storage.loadById('non-existent-id');
      expect(loaded).toBeNull();
    });
  });

  describe('loadByLabel', () => {
    it('should load all benchmarks with matching label', async () => {
      const results = createResults();
      await storage.save('test-label', results, defaultConfig);
      await storage.save('test-label', results, {
        ...defaultConfig,
        scenario: 'async-io-50ms',
      });
      await storage.save('other-label', results, defaultConfig);

      const loaded = await storage.loadByLabel('test-label');

      expect(loaded).toHaveLength(2);
    });

    it('should return empty array for non-existent label', async () => {
      const loaded = await storage.loadByLabel('non-existent');
      expect(loaded).toHaveLength(0);
    });
  });

  describe('loadByLabelAndConfig', () => {
    it('should filter by app', async () => {
      const results = createResults();
      await storage.save('test-label', results, { ...defaultConfig, app: 'express' });
      await storage.save('test-label', results, { ...defaultConfig, app: 'fastify' });

      const loaded = await storage.loadByLabelAndConfig('test-label', 'express');

      expect(loaded).toHaveLength(1);
      expect(loaded[0].metadata.config.app).toBe('express');
    });

    it('should filter by scenario', async () => {
      const results = createResults();
      await storage.save('test-label', results, {
        ...defaultConfig,
        scenario: 'simple-json',
      });
      await storage.save('test-label', results, {
        ...defaultConfig,
        scenario: 'async-io-50ms',
      });

      const loaded = await storage.loadByLabelAndConfig(
        'test-label',
        undefined,
        'simple-json'
      );

      expect(loaded).toHaveLength(1);
      expect(loaded[0].metadata.config.scenario).toBe('simple-json');
    });

    it('should filter by mode', async () => {
      const results = createResults();
      await storage.save('test-label', results, { ...defaultConfig, mode: 'baseline' });
      await storage.save('test-label', results, { ...defaultConfig, mode: 'otel-noop' });

      const loaded = await storage.loadByLabelAndConfig(
        'test-label',
        undefined,
        undefined,
        'baseline'
      );

      expect(loaded).toHaveLength(1);
      expect(loaded[0].metadata.config.mode).toBe('baseline');
    });

    it('should combine multiple filters', async () => {
      const results = createResults();
      await storage.save('test-label', results, {
        app: 'express',
        scenario: 'simple-json',
        mode: 'baseline',
        connections: 10,
        duration: 30,
        pipelining: 1,
      });
      await storage.save('test-label', results, {
        app: 'express',
        scenario: 'simple-json',
        mode: 'otel-noop',
        connections: 10,
        duration: 30,
        pipelining: 1,
      });
      await storage.save('test-label', results, {
        app: 'fastify',
        scenario: 'simple-json',
        mode: 'baseline',
        connections: 10,
        duration: 30,
        pipelining: 1,
      });

      const loaded = await storage.loadByLabelAndConfig(
        'test-label',
        'express',
        'simple-json',
        'baseline'
      );

      expect(loaded).toHaveLength(1);
    });
  });

  describe('findMatchingPairs', () => {
    it('should find matching baseline-target pairs', async () => {
      const results = createResults();
      await storage.save('baseline', results, {
        app: 'express',
        scenario: 'simple-json',
        mode: 'baseline',
        connections: 10,
        duration: 30,
        pipelining: 1,
      });
      await storage.save('target', results, {
        app: 'express',
        scenario: 'simple-json',
        mode: 'baseline',
        connections: 10,
        duration: 30,
        pipelining: 1,
      });

      const pairs = await storage.findMatchingPairs('baseline', 'target');

      expect(pairs).toHaveLength(1);
      expect(pairs[0].baseline.metadata.label).toBe('baseline');
      expect(pairs[0].target.metadata.label).toBe('target');
    });

    it('should not match different configurations', async () => {
      const results = createResults();
      await storage.save('baseline', results, {
        app: 'express',
        scenario: 'simple-json',
        mode: 'baseline',
        connections: 10,
        duration: 30,
        pipelining: 1,
      });
      await storage.save('target', results, {
        app: 'fastify', // Different app
        scenario: 'simple-json',
        mode: 'baseline',
        connections: 10,
        duration: 30,
        pipelining: 1,
      });

      const pairs = await storage.findMatchingPairs('baseline', 'target');

      expect(pairs).toHaveLength(0);
    });

    it('should filter pairs by app', async () => {
      const results = createResults();
      await storage.save('baseline', results, {
        app: 'express',
        scenario: 'simple-json',
        mode: 'baseline',
        connections: 10,
        duration: 30,
        pipelining: 1,
      });
      await storage.save('baseline', results, {
        app: 'fastify',
        scenario: 'simple-json',
        mode: 'baseline',
        connections: 10,
        duration: 30,
        pipelining: 1,
      });
      await storage.save('target', results, {
        app: 'express',
        scenario: 'simple-json',
        mode: 'baseline',
        connections: 10,
        duration: 30,
        pipelining: 1,
      });
      await storage.save('target', results, {
        app: 'fastify',
        scenario: 'simple-json',
        mode: 'baseline',
        connections: 10,
        duration: 30,
        pipelining: 1,
      });

      const pairs = await storage.findMatchingPairs('baseline', 'target', 'express');

      expect(pairs).toHaveLength(1);
      expect(pairs[0].baseline.metadata.config.app).toBe('express');
    });
  });

  describe('list', () => {
    it('should return all index entries', async () => {
      const results = createResults();
      await storage.save('label1', results, defaultConfig);
      await storage.save('label2', results, defaultConfig);

      const list = await storage.list();

      expect(list).toHaveLength(2);
    });

    it('should return empty array when no benchmarks', async () => {
      const list = await storage.list();
      expect(list).toHaveLength(0);
    });
  });

  describe('listByLabel', () => {
    it('should return entries matching label', async () => {
      const results = createResults();
      await storage.save('target-label', results, defaultConfig);
      await storage.save('target-label', results, {
        ...defaultConfig,
        scenario: 'async-io-50ms',
      });
      await storage.save('other-label', results, defaultConfig);

      const list = await storage.listByLabel('target-label');

      expect(list).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('should delete by ID', async () => {
      const results = createResults();
      const id = await storage.save('test-label', results, defaultConfig);

      const deleted = await storage.delete(id);

      expect(deleted).toBe(true);
      const loaded = await storage.loadById(id);
      expect(loaded).toBeNull();
    });

    it('should delete by label', async () => {
      const results = createResults();
      await storage.save('test-label', results, defaultConfig);

      const deleted = await storage.delete('test-label');

      expect(deleted).toBe(true);
      const list = await storage.list();
      expect(list).toHaveLength(0);
    });

    it('should return false for non-existent entry', async () => {
      const deleted = await storage.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('deleteByLabel', () => {
    it('should delete all entries with matching label', async () => {
      const results = createResults();
      await storage.save('delete-me', results, defaultConfig);
      await storage.save('delete-me', results, {
        ...defaultConfig,
        scenario: 'async-io-50ms',
      });
      await storage.save('keep-me', results, defaultConfig);

      const count = await storage.deleteByLabel('delete-me');

      expect(count).toBe(2);
      const list = await storage.list();
      expect(list).toHaveLength(1);
      expect(list[0].label).toBe('keep-me');
    });

    it('should return 0 when label does not exist', async () => {
      const count = await storage.deleteByLabel('non-existent');
      expect(count).toBe(0);
    });
  });

  describe('rebuildIndex', () => {
    it('should rebuild index from benchmark files', async () => {
      const results = createResults();
      await storage.save('label1', results, defaultConfig);
      await storage.save('label2', results, defaultConfig);

      // Clear the index by writing empty array
      const indexPath = path.join(tempDir, 'index.json');
      await fs.writeFile(indexPath, '[]');

      // Verify index is empty
      let list = await storage.list();
      expect(list).toHaveLength(0);

      // Rebuild
      const count = await storage.rebuildIndex();

      expect(count).toBe(2);
      list = await storage.list();
      expect(list).toHaveLength(2);
    });

    it('should handle empty benchmarks directory', async () => {
      const count = await storage.rebuildIndex();
      expect(count).toBe(0);
    });

    it('should sort index by timestamp descending', async () => {
      const results = createResults();
      await storage.save('older', results, defaultConfig);
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      await storage.save('newer', results, defaultConfig);

      await storage.rebuildIndex();
      const list = await storage.list();

      expect(list[0].label).toBe('newer');
      expect(list[1].label).toBe('older');
    });

    it('should skip non-JSON files', async () => {
      const results = createResults();
      await storage.save('label1', results, defaultConfig);

      // Add a non-JSON file
      const benchmarksDir = path.join(tempDir, 'benchmarks');
      await fs.writeFile(path.join(benchmarksDir, 'readme.txt'), 'not json');

      const count = await storage.rebuildIndex();

      expect(count).toBe(1);
    });

    it('should skip invalid JSON files', async () => {
      const results = createResults();
      await storage.save('label1', results, defaultConfig);

      // Add an invalid JSON file
      const benchmarksDir = path.join(tempDir, 'benchmarks');
      await fs.writeFile(
        path.join(benchmarksDir, 'invalid.json'),
        'not valid json'
      );

      const count = await storage.rebuildIndex();

      expect(count).toBe(1);
    });
  });
});
