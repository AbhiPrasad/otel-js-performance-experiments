import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import type { LinkConfig } from './types.js';
import { DEFAULT_TARGET_PACKAGES, PACKAGE_LOCATIONS } from './types.js';

const execAsync = promisify(exec);

export class LinkManager {
  private otelJsPath: string;
  private testAppPath: string;

  constructor(config: LinkConfig) {
    this.otelJsPath = config.otelJsPath;
    this.testAppPath = config.testAppPath;
  }

  /**
   * Update the test app's package.json to use file: protocol links
   * This is more reliable than npm link for workspaces
   */
  async linkWithFileProtocol(packages: string[] = DEFAULT_TARGET_PACKAGES): Promise<void> {
    const pkgJsonPath = path.join(this.testAppPath, 'package.json');
    const content = await fs.readFile(pkgJsonPath, 'utf-8');
    const pkgJson = JSON.parse(content);

    // Store original dependencies for later restoration
    const originalDeps = { ...pkgJson.dependencies };
    await fs.writeFile(
      path.join(this.testAppPath, '.original-deps.json'),
      JSON.stringify(originalDeps, null, 2)
    );

    // Create file: protocol links
    const localDeps: Record<string, string> = {};
    for (const pkg of packages) {
      const relativePath = PACKAGE_LOCATIONS[pkg];
      if (relativePath) {
        localDeps[pkg] = `file:${path.join(this.otelJsPath, relativePath)}`;
      }
    }

    // Update package.json
    pkgJson.dependencies = { ...pkgJson.dependencies, ...localDeps };
    await fs.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

    // Reinstall with new deps
    console.log(`Linking packages to ${this.testAppPath}...`);
    await execAsync('npm install', { cwd: this.testAppPath });
  }

  /**
   * Restore original dependencies and reinstall
   */
  async unlink(): Promise<void> {
    const originalDepsPath = path.join(this.testAppPath, '.original-deps.json');
    const pkgJsonPath = path.join(this.testAppPath, 'package.json');

    try {
      const originalDeps = JSON.parse(await fs.readFile(originalDepsPath, 'utf-8'));
      const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));

      pkgJson.dependencies = originalDeps;
      await fs.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

      // Clean up
      await fs.unlink(originalDepsPath);

      // Reinstall original deps
      console.log('Restoring original dependencies...');
      await execAsync('npm install', { cwd: this.testAppPath });
    } catch {
      // No original deps file, just reinstall
      console.log('No original deps to restore, running fresh install...');
      await execAsync('rm -rf node_modules', { cwd: this.testAppPath });
      await execAsync('npm install', { cwd: this.testAppPath });
    }
  }

  /**
   * Create global npm links for all OTel packages
   * Run once per otel-js build, then use linkToTestApp
   */
  async createGlobalLinks(packages: string[] = DEFAULT_TARGET_PACKAGES): Promise<void> {
    for (const pkg of packages) {
      const relativePath = PACKAGE_LOCATIONS[pkg];
      if (relativePath) {
        const pkgPath = path.join(this.otelJsPath, relativePath);
        console.log(`Creating npm link for ${pkg}...`);
        await execAsync('npm link', { cwd: pkgPath });
      }
    }
  }

  /**
   * Link pre-created npm links to the test app
   */
  async linkToTestApp(packages: string[] = DEFAULT_TARGET_PACKAGES): Promise<void> {
    const linkArgs = packages.join(' ');
    console.log(`Linking packages to ${this.testAppPath}...`);
    await execAsync(`npm link ${linkArgs}`, { cwd: this.testAppPath });
  }

  /**
   * Verify that packages are properly linked
   */
  async verifyLinks(packages: string[] = DEFAULT_TARGET_PACKAGES): Promise<{
    success: boolean;
    linked: string[];
    missing: string[];
  }> {
    const linked: string[] = [];
    const missing: string[] = [];

    for (const pkg of packages) {
      const modulePath = path.join(this.testAppPath, 'node_modules', ...pkg.split('/'));
      try {
        const stat = await fs.lstat(modulePath);
        if (stat.isSymbolicLink()) {
          linked.push(pkg);
        } else {
          // Check if it's a file: protocol link by reading package.json
          const pkgJsonPath = path.join(this.testAppPath, 'package.json');
          const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));
          const dep = pkgJson.dependencies?.[pkg];
          if (dep && dep.startsWith('file:')) {
            linked.push(pkg);
          } else {
            missing.push(pkg);
          }
        }
      } catch {
        missing.push(pkg);
      }
    }

    return {
      success: missing.length === 0,
      linked,
      missing,
    };
  }
}
