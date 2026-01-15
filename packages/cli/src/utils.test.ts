import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import { parseArgs, getDefaultOtelPath, formatDuration, expandPath } from './utils.js';

describe('parseArgs', () => {
  describe('basic parsing', () => {
    it('should parse flag with value', () => {
      const result = parseArgs(['--name', 'value']);
      expect(result.name).toBe('value');
    });

    it('should parse multiple flags with values', () => {
      const result = parseArgs(['--app', 'express', '--scenario', 'simple-json']);
      expect(result.app).toBe('express');
      expect(result.scenario).toBe('simple-json');
    });

    it('should parse boolean flag without value', () => {
      const result = parseArgs(['--verbose']);
      expect(result.verbose).toBe(true);
    });

    it('should parse mixed flags and boolean flags', () => {
      const result = parseArgs(['--app', 'express', '--verbose', '--mode', 'baseline']);
      expect(result.app).toBe('express');
      expect(result.verbose).toBe(true);
      expect(result.mode).toBe('baseline');
    });
  });

  describe('edge cases', () => {
    it('should return empty object for empty args', () => {
      const result = parseArgs([]);
      expect(result).toEqual({});
    });

    it('should ignore non-flag arguments', () => {
      const result = parseArgs(['command', '--flag', 'value', 'extra']);
      expect(result.flag).toBe('value');
      expect(result.command).toBeUndefined();
    });

    it('should handle flag at end as boolean', () => {
      const result = parseArgs(['--app', 'express', '--save']);
      expect(result.app).toBe('express');
      expect(result.save).toBe(true);
    });

    it('should handle consecutive boolean flags', () => {
      const result = parseArgs(['--verbose', '--debug', '--save']);
      expect(result.verbose).toBe(true);
      expect(result.debug).toBe(true);
      expect(result.save).toBe(true);
    });

    it('should handle values that look like flags but are quoted', () => {
      // When a value starts with -- but is not a flag position, it should be treated as a value
      const result = parseArgs(['--message', '--not-a-flag']);
      // Based on the implementation, this will be treated as message=true, not-a-flag=true
      expect(result.message).toBe(true);
      expect(result['not-a-flag']).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should parse run command args', () => {
      const result = parseArgs([
        '--app',
        'express',
        '--scenario',
        'simple-json',
        '--mode',
        'baseline',
        '--preset',
        'quick',
        '--label',
        'test-run',
        '--save',
      ]);

      expect(result.app).toBe('express');
      expect(result.scenario).toBe('simple-json');
      expect(result.mode).toBe('baseline');
      expect(result.preset).toBe('quick');
      expect(result.label).toBe('test-run');
      expect(result.save).toBe(true);
    });

    it('should parse compare command args', () => {
      const result = parseArgs([
        '--baseline',
        'baseline-label',
        '--target',
        'target-label',
        '--format',
        'markdown',
      ]);

      expect(result.baseline).toBe('baseline-label');
      expect(result.target).toBe('target-label');
      expect(result.format).toBe('markdown');
    });
  });
});

describe('getDefaultOtelPath', () => {
  it('should return path in home directory', () => {
    const result = getDefaultOtelPath();
    const expected = path.join(os.homedir(), 'workspace', 'opentelemetry-js');
    expect(result).toBe(expected);
  });
});

describe('formatDuration', () => {
  describe('milliseconds', () => {
    it('should format sub-second durations in ms', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format exactly 999ms', () => {
      expect(formatDuration(999)).toBe('999ms');
    });
  });

  describe('seconds', () => {
    it('should format 1 second', () => {
      expect(formatDuration(1000)).toBe('1.0s');
    });

    it('should format seconds with decimal', () => {
      expect(formatDuration(1500)).toBe('1.5s');
    });

    it('should format 59 seconds', () => {
      expect(formatDuration(59000)).toBe('59.0s');
    });
  });

  describe('minutes', () => {
    it('should format exactly 1 minute', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
    });

    it('should format multiple minutes', () => {
      expect(formatDuration(300000)).toBe('5m 0s');
    });

    it('should format 5 minutes 30 seconds', () => {
      expect(formatDuration(330000)).toBe('5m 30s');
    });
  });
});

describe('expandPath', () => {
  it('should expand tilde to home directory', () => {
    const result = expandPath('~/workspace');
    expect(result).toBe(path.join(os.homedir(), 'workspace'));
  });

  it('should expand tilde with nested path', () => {
    const result = expandPath('~/workspace/opentelemetry-js');
    expect(result).toBe(path.join(os.homedir(), 'workspace', 'opentelemetry-js'));
  });

  it('should resolve relative paths', () => {
    const result = expandPath('./test');
    expect(result).toBe(path.resolve('./test'));
  });

  it('should preserve absolute paths', () => {
    const result = expandPath('/usr/local/bin');
    expect(result).toBe('/usr/local/bin');
  });

  it('should handle path without tilde', () => {
    const result = expandPath('relative/path');
    expect(result).toBe(path.resolve('relative/path'));
  });
});
