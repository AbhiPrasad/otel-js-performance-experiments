import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import type { BuildConfig } from './types.js';
import { DEFAULT_TARGET_PACKAGES, PACKAGE_LOCATIONS } from './types.js';

const execAsync = promisify(exec);

export class BuildManager {
  private otelJsPath: string;
  private targetPackages: string[];

  constructor(config: BuildConfig) {
    this.otelJsPath = config.otelJsPath;
    this.targetPackages = config.targetPackages || DEFAULT_TARGET_PACKAGES;
  }

  async clean(): Promise<void> {
    console.log('Cleaning otel-js build artifacts...');
    await execAsync('npm run clean', {
      cwd: this.otelJsPath,
      timeout: 120000,
    });
  }

  async install(): Promise<void> {
    console.log('Installing otel-js dependencies...');
    await execAsync('npm ci', {
      cwd: this.otelJsPath,
      timeout: 300000,
    });
  }

  async build(): Promise<void> {
    console.log('Building otel-js...');

    // Run precompile (submodules, protos, version updates)
    try {
      await execAsync('npm run precompile', {
        cwd: this.otelJsPath,
        timeout: 120000,
      });
    } catch (err) {
      // precompile might fail if submodules not initialized, try to continue
      console.warn('Precompile step had issues, continuing with compile...');
    }

    // Full build
    await execAsync('npm run compile', {
      cwd: this.otelJsPath,
      timeout: 600000, // 10 minutes
    });
  }

  async fullRebuild(): Promise<void> {
    await this.clean();
    await this.install();
    await this.build();
  }

  getPackagePaths(): Map<string, string> {
    const packagePaths = new Map<string, string>();

    for (const pkg of this.targetPackages) {
      const relativePath = PACKAGE_LOCATIONS[pkg];
      if (relativePath) {
        packagePaths.set(pkg, path.join(this.otelJsPath, relativePath));
      }
    }

    return packagePaths;
  }

  async verifyBuild(): Promise<{ success: boolean; missing: string[] }> {
    const packagePaths = this.getPackagePaths();
    const missing: string[] = [];

    for (const [pkgName, pkgPath] of packagePaths) {
      const buildPath = path.join(pkgPath, 'build');
      try {
        await fs.access(buildPath);
      } catch {
        missing.push(pkgName);
      }
    }

    return {
      success: missing.length === 0,
      missing,
    };
  }

  async getPackageVersion(packageName: string): Promise<string | null> {
    const packagePath = PACKAGE_LOCATIONS[packageName];
    if (!packagePath) return null;

    const pkgJsonPath = path.join(this.otelJsPath, packagePath, 'package.json');

    try {
      const content = await fs.readFile(pkgJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      return pkg.version;
    } catch {
      return null;
    }
  }

  async getAllPackageVersions(): Promise<Record<string, string>> {
    const versions: Record<string, string> = {};

    for (const pkg of this.targetPackages) {
      const version = await this.getPackageVersion(pkg);
      if (version) {
        versions[pkg] = version;
      }
    }

    return versions;
  }
}
