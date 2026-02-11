/**
 * UAS Engine — Windows Smart Downloader
 *
 * Handles idempotent downloads:
 * 1. If file exists and SHA-256 matches → skip download
 * 2. If file exists but checksum mismatches → delete and redownload
 * 3. On failure → clean up partial files, preserve valid cached copies
 */

import * as fs from "fs";
import * as path from "path";
import { Logger } from "../utils/logger";
import { computeFileHash } from "../verifier";
import { downloadFile, DownloadResult, ProgressCallback } from "../downloader";
import { DownloadDecision } from "./types";

export interface SmartDownloadOptions {
  /** HTTPS URL of the installer */
  url: string;
  /** Expected SHA-256 hex string */
  expectedSha256: string;
  /** Directory to store the file */
  destDir: string;
  /** Filename override (derived from URL if omitted) */
  filename?: string;
  /** Progress callback */
  onProgress?: ProgressCallback;
  /** Logger */
  logger: Logger;
}

export interface SmartDownloadResult {
  /** Absolute path to the valid installer file */
  filePath: string;
  /** Whether a download actually happened */
  downloaded: boolean;
  /** Reason download was skipped (if it was) */
  skipReason?: string;
  /** Bytes downloaded (0 if skipped) */
  bytesDownloaded: number;
  /** Duration in ms (0 if skipped) */
  durationMs: number;
}

/**
 * Check whether the file at `filePath` already exists with a matching checksum.
 */
export async function evaluateDownload(
  filePath: string,
  expectedSha256: string,
  logger: Logger,
): Promise<DownloadDecision> {
  if (!fs.existsSync(filePath)) {
    logger.debug({ path: filePath }, "Installer not cached - download needed");
    return { needed: true, filePath };
  }

  // File exists — verify checksum
  logger.debug(
    { path: filePath },
    "Cached installer found - verifying checksum",
  );
  try {
    const actual = await computeFileHash(filePath);
    const expected = expectedSha256.toLowerCase().trim();

    if (actual === expected) {
      logger.info(
        { path: filePath, sha256: actual },
        "Cached installer checksum matches - skipping download",
      );
      return { needed: false, reason: "cached_valid", filePath };
    }

    // Mismatch — delete stale file
    logger.warn(
      { path: filePath, expected, actual },
      "Cached installer checksum mismatch - will redownload",
    );
    fs.unlinkSync(filePath);
    return { needed: true, reason: "exists_mismatch_redownload", filePath };
  } catch (err: unknown) {
    // If hashing fails, delete and redownload
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ error: msg }, "Failed to hash cached file - will redownload");
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
    return { needed: true, filePath };
  }
}

/**
 * Smart download: skip if cached and valid, otherwise download.
 * Cleans up partial files on failure but preserves valid cached copies.
 */
export async function smartDownload(
  opts: SmartDownloadOptions,
): Promise<SmartDownloadResult> {
  const { url, expectedSha256, destDir, filename, onProgress, logger } = opts;

  // Derive filename
  const resolvedFilename =
    filename || path.basename(new URL(url).pathname) || "installer";
  const filePath = path.join(destDir, resolvedFilename);

  // Ensure directory
  fs.mkdirSync(destDir, { recursive: true });

  // Check cache
  const decision = await evaluateDownload(filePath, expectedSha256, logger);

  if (!decision.needed) {
    return {
      filePath,
      downloaded: false,
      skipReason: "Installer already cached with valid checksum",
      bytesDownloaded: 0,
      durationMs: 0,
    };
  }

  // Download
  logger.info({ url, dest: filePath }, "Downloading installer");
  let result: DownloadResult;
  try {
    result = await downloadFile(
      url,
      destDir,
      resolvedFilename,
      onProgress,
      logger,
    );
  } catch (err: unknown) {
    // Clean up partial file on failure
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.debug({ path: filePath }, "Cleaned up partial download");
      } catch {
        /* ignore */
      }
    }
    throw err;
  }

  // Post-download verification
  const actual = await computeFileHash(result.file_path);
  const expected = expectedSha256.toLowerCase().trim();
  if (actual !== expected) {
    // Do NOT delete — preserve for debugging
    throw new Error(
      `Downloaded file checksum mismatch: expected ${expected}, got ${actual}. ` +
        `File preserved at ${result.file_path} for inspection.`,
    );
  }

  logger.info(
    { path: result.file_path, sha256: actual, ms: result.duration_ms },
    "Download complete - checksum verified",
  );

  return {
    filePath: result.file_path,
    downloaded: true,
    bytesDownloaded: result.bytes_downloaded,
    durationMs: result.duration_ms,
  };
}
