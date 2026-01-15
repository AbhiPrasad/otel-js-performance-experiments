import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import type {
  BenchmarkMetadata,
  BenchmarkResults,
  StoredBenchmark,
  IndexEntry,
} from './schema.js';

export interface StorageConfig {
  resultsDir: string;
}

export class ResultsStorage {
  private resultsDir: string;

  constructor(config: StorageConfig) {
    this.resultsDir = config.resultsDir;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.resultsDir, { recursive: true });
    await fs.mkdir(path.join(this.resultsDir, 'benchmarks'), { recursive: true });
    await fs.mkdir(path.join(this.resultsDir, 'comparisons'), { recursive: true });
    await fs.mkdir(path.join(this.resultsDir, 'clinic-reports'), { recursive: true });
  }

  async save(
    label: string,
    results: BenchmarkResults,
    config: BenchmarkMetadata['config'],
    gitInfo?: Partial<BenchmarkMetadata['git']>
  ): Promise<string> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    const metadata: BenchmarkMetadata = {
      id,
      label,
      timestamp,
      git: {
        branch: gitInfo?.branch || 'unknown',
        commit: gitInfo?.commit || 'unknown',
        shortCommit: gitInfo?.shortCommit || gitInfo?.commit?.substring(0, 7) || 'unknown',
        commitMessage: gitInfo?.commitMessage || '',
        commitDate: gitInfo?.commitDate || '',
        isPR: gitInfo?.isPR,
        prNumber: gitInfo?.prNumber,
        tag: gitInfo?.tag,
      },
      environment: this.captureEnvironment(),
      config,
    };

    const benchmark: StoredBenchmark = { metadata, results };

    const filename = `${timestamp.replace(/[:.]/g, '-')}_${label.replace(/[^a-zA-Z0-9-]/g, '_')}_${id}.json`;
    const filepath = path.join(this.resultsDir, 'benchmarks', filename);

    await fs.writeFile(filepath, JSON.stringify(benchmark, null, 2));

    // Update the index
    await this.updateIndex({
      id,
      label,
      timestamp,
      filepath,
      app: config.app,
      scenario: config.scenario,
      mode: config.mode,
      git: {
        branch: metadata.git.branch,
        commit: metadata.git.commit,
        tag: metadata.git.tag,
      },
    });

    return id;
  }

  async load(idOrLabel: string): Promise<StoredBenchmark | null> {
    const index = await this.loadIndex();
    const entry = index.find((e) => e.id === idOrLabel || e.label === idOrLabel);

    if (!entry) return null;

    const content = await fs.readFile(entry.filepath, 'utf-8');
    return JSON.parse(content);
  }

  async loadById(id: string): Promise<StoredBenchmark | null> {
    const index = await this.loadIndex();
    const entry = index.find((e) => e.id === id);

    if (!entry) return null;

    const content = await fs.readFile(entry.filepath, 'utf-8');
    return JSON.parse(content);
  }

  async loadByLabel(label: string): Promise<StoredBenchmark[]> {
    const index = await this.loadIndex();
    const entries = index.filter((e) => e.label === label);

    const results: StoredBenchmark[] = [];
    for (const entry of entries) {
      try {
        const content = await fs.readFile(entry.filepath, 'utf-8');
        results.push(JSON.parse(content));
      } catch {
        // Skip files that can't be read
      }
    }

    return results;
  }

  async loadByLabelAndConfig(
    label: string,
    app?: string,
    scenario?: string,
    mode?: string
  ): Promise<StoredBenchmark[]> {
    const index = await this.loadIndex();
    const entries = index.filter((e) => {
      if (e.label !== label) return false;
      if (app && e.app !== app) return false;
      if (scenario && e.scenario !== scenario) return false;
      if (mode && e.mode !== mode) return false;
      return true;
    });

    const results: StoredBenchmark[] = [];
    for (const entry of entries) {
      try {
        const content = await fs.readFile(entry.filepath, 'utf-8');
        results.push(JSON.parse(content));
      } catch {
        // Skip files that can't be read
      }
    }

    return results;
  }

  async findMatchingPairs(
    baselineLabel: string,
    targetLabel: string,
    app?: string,
    scenario?: string,
    mode?: string
  ): Promise<Array<{ baseline: StoredBenchmark; target: StoredBenchmark }>> {
    const baselineResults = await this.loadByLabelAndConfig(baselineLabel, app, scenario, mode);
    const targetResults = await this.loadByLabelAndConfig(targetLabel, app, scenario, mode);

    const pairs: Array<{ baseline: StoredBenchmark; target: StoredBenchmark }> = [];

    for (const baseline of baselineResults) {
      const { app: bApp, scenario: bScenario, mode: bMode } = baseline.metadata.config;
      const matchingTarget = targetResults.find(
        (t) =>
          t.metadata.config.app === bApp &&
          t.metadata.config.scenario === bScenario &&
          t.metadata.config.mode === bMode
      );

      if (matchingTarget) {
        pairs.push({ baseline, target: matchingTarget });
      }
    }

    return pairs;
  }

  async list(): Promise<IndexEntry[]> {
    return this.loadIndex();
  }

  async listByLabel(label: string): Promise<IndexEntry[]> {
    const index = await this.loadIndex();
    return index.filter((e) => e.label === label);
  }

  async delete(idOrLabel: string): Promise<boolean> {
    const index = await this.loadIndex();
    const entryIndex = index.findIndex((e) => e.id === idOrLabel || e.label === idOrLabel);

    if (entryIndex === -1) return false;

    const entry = index[entryIndex];

    try {
      await fs.unlink(entry.filepath);
    } catch {
      // File might already be deleted
    }

    index.splice(entryIndex, 1);
    await this.saveIndex(index);

    return true;
  }

  async deleteByLabel(label: string): Promise<number> {
    const index = await this.loadIndex();
    const toDelete = index.filter((e) => e.label === label);

    for (const entry of toDelete) {
      try {
        await fs.unlink(entry.filepath);
      } catch {
        // File might already be deleted
      }
    }

    const newIndex = index.filter((e) => e.label !== label);
    await this.saveIndex(newIndex);

    return toDelete.length;
  }

  async rebuildIndex(): Promise<number> {
    const benchmarksDir = path.join(this.resultsDir, 'benchmarks');
    const index: IndexEntry[] = [];

    try {
      const files = await fs.readdir(benchmarksDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filepath = path.join(benchmarksDir, file);
        try {
          const content = await fs.readFile(filepath, 'utf-8');
          const benchmark: StoredBenchmark = JSON.parse(content);
          const { metadata } = benchmark;

          index.push({
            id: metadata.id,
            label: metadata.label,
            timestamp: metadata.timestamp,
            filepath,
            app: metadata.config.app,
            scenario: metadata.config.scenario,
            mode: metadata.config.mode,
            git: {
              branch: metadata.git.branch,
              commit: metadata.git.commit,
              tag: metadata.git.tag,
            },
          });
        } catch {
          // Skip files that can't be parsed
        }
      }

      // Sort by timestamp descending
      index.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      await this.saveIndex(index);

      return index.length;
    } catch {
      // Directory might not exist
      return 0;
    }
  }

  private captureEnvironment(): BenchmarkMetadata['environment'] {
    const cpus = os.cpus();
    return {
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpuModel: cpus[0]?.model || 'unknown',
      cpuCores: cpus.length,
      totalMemory: os.totalmem(),
    };
  }

  private async loadIndex(): Promise<IndexEntry[]> {
    const indexPath = path.join(this.resultsDir, 'index.json');
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private async saveIndex(index: IndexEntry[]): Promise<void> {
    const indexPath = path.join(this.resultsDir, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
  }

  private async updateIndex(entry: IndexEntry): Promise<void> {
    const index = await this.loadIndex();
    index.push(entry);
    await this.saveIndex(index);
  }
}
