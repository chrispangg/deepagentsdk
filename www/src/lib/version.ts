/**
 * Fetches the latest published version of deepagentsdk from npm registry
 * Falls back to reading from package.json if fetch fails
 */

const NPM_PACKAGE_NAME = 'deepagentsdk';
const GITHUB_REPO = 'chrispangg/deepagentsdk';

interface NpmPackageData {
  'dist-tags': {
    latest: string;
  };
}

interface GitHubRelease {
  tag_name: string;
  name: string;
}

/**
 * Fetch latest version from npm registry
 * Cached for 1 hour in production, always fresh in development
 */
export async function getLatestVersion(): Promise<string> {
  try {
    // Try npm registry first (more reliable for package version)
    const npmResponse = await fetch(
      `https://registry.npmjs.org/${NPM_PACKAGE_NAME}`,
      {
        next: {
          revalidate: process.env.NODE_ENV === 'production' ? 3600 : 0, // 1 hour in prod, always fresh in dev
        },
      }
    );

    if (npmResponse.ok) {
      const data = (await npmResponse.json()) as NpmPackageData;
      return data['dist-tags'].latest;
    }
  } catch (error) {
    console.warn('Failed to fetch version from npm:', error);
  }

  // Fallback to GitHub releases
  try {
    const githubResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        next: {
          revalidate: process.env.NODE_ENV === 'production' ? 3600 : 0,
        },
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (githubResponse.ok) {
      const data = (await githubResponse.json()) as GitHubRelease;
      // Remove 'v' prefix if present
      return data.tag_name.replace(/^v/, '');
    }
  } catch (error) {
    console.warn('Failed to fetch version from GitHub:', error);
  }

  // Final fallback - read from local package.json
  try {
    const packageJson = await import('../../../package.json');
    return packageJson.version || '0.9.2';
  } catch {
    // Hard-coded fallback as last resort
    return '0.9.2';
  }
}
