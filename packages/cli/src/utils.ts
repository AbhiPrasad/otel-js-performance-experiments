import path from 'path';
import os from 'os';

export function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Check if next arg is a value or another flag
      if (nextArg && !nextArg.startsWith('--')) {
        result[key] = nextArg;
        i++; // Skip the next arg
      } else {
        result[key] = true;
      }
    }
  }

  return result;
}

export function getDefaultOtelPath(): string {
  return path.join(os.homedir(), 'workspace', 'opentelemetry-js');
}

export function getProjectRoot(): string {
  // Find the project root by looking for package.json with workspaces
  let dir = process.cwd();
  while (dir !== '/') {
    try {
      const pkgPath = path.join(dir, 'package.json');
      const pkg = require(pkgPath);
      if (pkg.workspaces) {
        return dir;
      }
    } catch {
      // Continue searching
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

export function expandPath(p: string): string {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return path.resolve(p);
}
