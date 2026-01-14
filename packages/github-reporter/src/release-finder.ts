import { Octokit } from '@octokit/rest';

export interface ReleaseInfo {
  tagName: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  body: string;
}

export interface GitHubRepoConfig {
  token?: string;
  owner: string;
  repo: string;
}

export class ReleaseFinder {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: GitHubRepoConfig) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
  }

  async getLatestRelease(): Promise<ReleaseInfo> {
    const response = await this.octokit.repos.getLatestRelease({
      owner: this.owner,
      repo: this.repo,
    });

    return {
      tagName: response.data.tag_name,
      name: response.data.name || response.data.tag_name,
      publishedAt: response.data.published_at || '',
      htmlUrl: response.data.html_url,
      body: response.data.body || '',
    };
  }

  async listReleases(perPage: number = 10): Promise<ReleaseInfo[]> {
    const response = await this.octokit.repos.listReleases({
      owner: this.owner,
      repo: this.repo,
      per_page: perPage,
    });

    return response.data.map((release) => ({
      tagName: release.tag_name,
      name: release.name || release.tag_name,
      publishedAt: release.published_at || '',
      htmlUrl: release.html_url,
      body: release.body || '',
    }));
  }

  async getReleaseByTag(tag: string): Promise<ReleaseInfo | null> {
    try {
      const response = await this.octokit.repos.getReleaseByTag({
        owner: this.owner,
        repo: this.repo,
        tag,
      });

      return {
        tagName: response.data.tag_name,
        name: response.data.name || response.data.tag_name,
        publishedAt: response.data.published_at || '',
        htmlUrl: response.data.html_url,
        body: response.data.body || '',
      };
    } catch {
      return null;
    }
  }

  async getLatestStableRelease(): Promise<ReleaseInfo | null> {
    // Get releases and filter out pre-releases
    const releases = await this.listReleases(20);
    const stableReleases = releases.filter(
      (r) => !r.tagName.includes('alpha') && !r.tagName.includes('beta') && !r.tagName.includes('rc')
    );

    return stableReleases[0] || null;
  }
}

export async function findLatestRelease(config: GitHubRepoConfig): Promise<ReleaseInfo> {
  const finder = new ReleaseFinder(config);
  return finder.getLatestRelease();
}

export async function findLatestStableRelease(
  config: GitHubRepoConfig
): Promise<ReleaseInfo | null> {
  const finder = new ReleaseFinder(config);
  return finder.getLatestStableRelease();
}
