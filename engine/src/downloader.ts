/**
 * UAS Engine — File Downloader
 *
 * Downloads installer files with progress reporting.
 * HTTPS only — HTTP URLs are rejected (security requirement).
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { Logger } from "./utils/logger";

export interface DownloadProgress {
  bytes_downloaded: number;
  bytes_total: number;
  percent: number;
}

export interface DownloadResult {
  file_path: string;
  bytes_downloaded: number;
  duration_ms: number;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Download a file from an HTTPS URL.
 *
 * @param url - HTTPS URL to download from
 * @param destDir - Directory to save the file in
 * @param filename - Filename to save as (optional, derived from URL if not provided)
 * @param onProgress - Progress callback
 * @param logger - Logger instance
 * @returns Download result with file path and stats
 */
export async function downloadFile(
  url: string,
  destDir: string,
  filename: string | undefined,
  onProgress: ProgressCallback | undefined,
  logger: Logger,
): Promise<DownloadResult> {
  // Security: reject non-HTTPS URLs
  if (!url.startsWith("https://")) {
    throw new Error(`Download URL must be HTTPS. Got: ${url}`);
  }

  // Derive filename from URL if not provided
  const resolvedFilename =
    filename || path.basename(new URL(url).pathname) || "download";
  const destPath = path.join(destDir, resolvedFilename);

  // Ensure destination directory exists
  fs.mkdirSync(destDir, { recursive: true });

  logger.info({ url, dest: destPath }, "Starting download");

  const startTime = Date.now();

  return new Promise<DownloadResult>((resolve, reject) => {
    const request = https.get(url, (response) => {
      // Handle redirects (up to 5 hops)
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        const redirectUrl = response.headers.location;
        logger.debug({ redirect: redirectUrl }, "Following redirect");
        downloadFile(redirectUrl, destDir, resolvedFilename, onProgress, logger)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(
          new Error(`Download failed: HTTP ${response.statusCode} for ${url}`),
        );
        return;
      }

      const totalBytes = parseInt(
        response.headers["content-length"] || "0",
        10,
      );
      let downloadedBytes = 0;

      const fileStream = fs.createWriteStream(destPath);

      response.on("data", (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (onProgress && totalBytes > 0) {
          onProgress({
            bytes_downloaded: downloadedBytes,
            bytes_total: totalBytes,
            percent: Math.round((downloadedBytes / totalBytes) * 100),
          });
        }
      });

      response.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        const duration = Date.now() - startTime;
        logger.info(
          { dest: destPath, bytes: downloadedBytes, duration_ms: duration },
          "Download complete",
        );
        resolve({
          file_path: destPath,
          bytes_downloaded: downloadedBytes,
          duration_ms: duration,
        });
      });

      fileStream.on("error", (err) => {
        // Clean up partial file
        fs.unlink(destPath, () => {
          /* ignore cleanup errors */
        });
        reject(new Error(`Failed to write downloaded file: ${err.message}`));
      });
    });

    request.on("error", (err) => {
      reject(new Error(`Download request failed: ${err.message}`));
    });

    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error(`Download timed out after 60 seconds: ${url}`));
    });
  });
}

/**
 * Check if a URL is reachable (HEAD request).
 * Used in RESOLVING state and dry-run mode.
 */
export async function checkUrlReachable(url: string): Promise<boolean> {
  if (!url.startsWith("https://")) {
    return false;
  }

  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const request = https.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: "HEAD",
        timeout: 10000,
      },
      (response) => {
        // 2xx or 3xx (redirect) means reachable
        resolve(
          response.statusCode !== undefined &&
            response.statusCode >= 200 &&
            response.statusCode < 400,
        );
      },
    );
    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.end();
  });
}
