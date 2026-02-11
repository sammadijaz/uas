/**
 * UAS Auto-Update — Configuration & Client
 *
 * Checks for new versions from GitHub Releases and triggers
 * download + install when available. Designed for Electron integration.
 *
 * Flow:
 *   1. On app start (or interval), call checkForUpdate()
 *   2. Compare local version vs latest GitHub release tag
 *   3. If newer version available, return update info
 *   4. App can prompt user → call downloadAndInstall()
 *   5. Downloads installer, runs it, quits current app
 */

import { app } from "electron";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt: string;
}

export interface AutoUpdateConfig {
  /** GitHub owner/repo */
  repo: string;
  /** Current app version (from package.json) */
  currentVersion: string;
  /** Check interval in ms (default: 4 hours) */
  checkInterval?: number;
  /** Asset filename pattern (default: uas-setup-{version}.exe) */
  assetPattern?: string;
}

const DEFAULT_CONFIG: Required<AutoUpdateConfig> = {
  repo: "user/uas",
  currentVersion: "0.1.0",
  checkInterval: 4 * 60 * 60 * 1000,
  assetPattern: "uas-setup-{version}.exe",
};

/**
 * Compare semver strings. Returns:
 *   1  if a > b
 *  -1  if a < b
 *   0  if equal
 */
function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

/**
 * Fetch JSON from GitHub API.
 */
function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "UAS-AutoUpdater",
          Accept: "application/vnd.github.v3+json",
        },
      },
      (res) => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          return fetchJSON(res.headers.location!).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

/**
 * Check GitHub Releases for a newer version.
 */
export async function checkForUpdate(
  config: Partial<AutoUpdateConfig> = {},
): Promise<UpdateInfo | null> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const url = `https://api.github.com/repos/${cfg.repo}/releases/latest`;

  try {
    const release = await fetchJSON(url);
    const latestVersion = (release.tag_name as string).replace(/^v/, "");

    if (compareSemver(latestVersion, cfg.currentVersion) <= 0) {
      return null; // Already up to date
    }

    // Find matching asset
    const assetName = cfg.assetPattern.replace("{version}", latestVersion);
    const asset = (release.assets as any[])?.find(
      (a: any) => a.name === assetName,
    );

    return {
      currentVersion: cfg.currentVersion,
      latestVersion,
      downloadUrl: asset?.browser_download_url || release.html_url,
      releaseNotes: release.body || "",
      publishedAt: release.published_at || "",
    };
  } catch (err) {
    console.error("[auto-update] Check failed:", err);
    return null;
  }
}

/**
 * Download the update installer and run it.
 */
export async function downloadAndInstall(update: UpdateInfo): Promise<void> {
  const tempDir = app?.getPath("temp") || process.env.TEMP || "/tmp";
  const filename = `uas-setup-${update.latestVersion}.exe`;
  const filepath = path.join(tempDir, filename);

  // Download
  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https
      .get(
        update.downloadUrl,
        {
          headers: { "User-Agent": "UAS-AutoUpdater" },
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            file.close();
            fs.unlinkSync(filepath);
            // Follow redirect
            https
              .get(res.headers.location!, (res2) => {
                res2.pipe(file);
                file.on("finish", () => {
                  file.close();
                  resolve();
                });
              })
              .on("error", reject);
            return;
          }
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        },
      )
      .on("error", reject);
  });

  // Run installer silently and quit
  execFile(filepath, ["/S"], (err) => {
    if (err) console.error("[auto-update] Install failed:", err);
  });

  // Quit current app after a short delay
  setTimeout(() => {
    if (app) app.quit();
  }, 1000);
}

/**
 * Start periodic update checks.
 */
export function startAutoUpdateLoop(
  config: Partial<AutoUpdateConfig> = {},
): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const check = async () => {
    const update = await checkForUpdate(cfg);
    if (update) {
      console.log(
        `[auto-update] New version available: ${update.latestVersion}`,
      );
      // In a real app, emit event or show notification to user
      // For now, just log
    }
  };

  // Initial check after 30 seconds
  setTimeout(check, 30_000);

  // Periodic checks
  setInterval(check, cfg.checkInterval);
}
