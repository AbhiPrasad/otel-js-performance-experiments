import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitConfig, CommitInfo, TagInfo } from './types.js';

const execAsync = promisify(exec);

export class GitOperations {
  private otelJsPath: string;

  constructor(config: GitConfig) {
    this.otelJsPath = config.otelJsPath;
  }

  async getCurrentBranch(): Promise<string> {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: this.otelJsPath,
    });
    return stdout.trim();
  }

  async getCurrentCommit(): Promise<string> {
    const { stdout } = await execAsync('git rev-parse HEAD', {
      cwd: this.otelJsPath,
    });
    return stdout.trim();
  }

  async getCommitInfo(ref: string = 'HEAD'): Promise<CommitInfo> {
    const format = '%H|||%h|||%s|||%an|||%ci';
    const { stdout } = await execAsync(`git log -1 --format="${format}" ${ref}`, {
      cwd: this.otelJsPath,
    });
    const [sha, shortSha, message, author, date] = stdout.trim().split('|||');
    return { sha, shortSha, message, author, date };
  }

  async fetchPR(prNumber: number): Promise<string> {
    const branchName = `pr-${prNumber}`;

    // First try to delete existing branch if it exists
    try {
      await execAsync(`git branch -D ${branchName}`, { cwd: this.otelJsPath });
    } catch {
      // Branch doesn't exist, that's fine
    }

    // Fetch the PR branch
    await execAsync(`git fetch origin pull/${prNumber}/head:${branchName}`, {
      cwd: this.otelJsPath,
    });

    return branchName;
  }

  async checkoutBranch(branch: string): Promise<void> {
    // Stash any changes first
    try {
      await execAsync('git stash', { cwd: this.otelJsPath });
    } catch {
      // Nothing to stash, that's fine
    }

    await execAsync(`git checkout ${branch}`, { cwd: this.otelJsPath });
  }

  async checkoutTag(tag: string): Promise<void> {
    await execAsync(`git checkout tags/${tag}`, { cwd: this.otelJsPath });
  }

  async checkoutCommit(commitSha: string): Promise<void> {
    await execAsync(`git checkout ${commitSha}`, { cwd: this.otelJsPath });
  }

  async getLatestTag(): Promise<TagInfo> {
    // Get the latest tag
    const { stdout: tagName } = await execAsync('git describe --tags --abbrev=0', {
      cwd: this.otelJsPath,
    });

    const tag = tagName.trim();

    // Get the commit for this tag
    const { stdout: commit } = await execAsync(`git rev-list -n 1 ${tag}`, {
      cwd: this.otelJsPath,
    });

    // Get the date
    const { stdout: date } = await execAsync(
      `git log -1 --format=%ci ${commit.trim()}`,
      { cwd: this.otelJsPath }
    );

    return {
      name: tag,
      commit: commit.trim(),
      date: date.trim(),
    };
  }

  async listTags(count: number = 10): Promise<TagInfo[]> {
    const { stdout } = await execAsync(
      `git tag --sort=-creatordate | head -n ${count}`,
      { cwd: this.otelJsPath }
    );

    const tags: TagInfo[] = [];
    for (const tagName of stdout.trim().split('\n')) {
      if (!tagName) continue;

      try {
        const { stdout: commit } = await execAsync(`git rev-list -n 1 ${tagName}`, {
          cwd: this.otelJsPath,
        });
        const { stdout: date } = await execAsync(
          `git log -1 --format=%ci ${commit.trim()}`,
          { cwd: this.otelJsPath }
        );
        tags.push({
          name: tagName,
          commit: commit.trim(),
          date: date.trim(),
        });
      } catch {
        // Skip invalid tags
      }
    }

    return tags;
  }

  async listRecentCommits(
    count: number = 10
  ): Promise<Array<{ sha: string; shortSha: string; message: string }>> {
    const { stdout } = await execAsync(`git log -${count} --format="%H|||%h|||%s"`, {
      cwd: this.otelJsPath,
    });

    return stdout
      .trim()
      .split('\n')
      .map((line) => {
        const [sha, shortSha, message] = line.split('|||');
        return { sha, shortSha, message };
      });
  }

  async fetch(): Promise<void> {
    await execAsync('git fetch origin', { cwd: this.otelJsPath });
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: this.otelJsPath,
    });
    return stdout.trim().length > 0;
  }

  async stash(): Promise<void> {
    await execAsync('git stash', { cwd: this.otelJsPath });
  }

  async stashPop(): Promise<void> {
    try {
      await execAsync('git stash pop', { cwd: this.otelJsPath });
    } catch {
      // Nothing to pop
    }
  }
}
