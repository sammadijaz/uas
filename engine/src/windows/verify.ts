/**
 * UAS Engine — Windows Integrity Verification
 *
 * Wraps the core verifier with Windows-pipeline-specific logic:
 * - Pre-install checksum validation
 * - Post-download verification with detailed error context
 * - Partial file detection
 */

import * as fs from "fs";
import { Logger } from "../utils/logger";
import { computeFileHash, verifyChecksum, VerificationResult } from "../verifier";

export { computeFileHash, verifyChecksum };
export type { VerificationResult };

/**
 * Verify a downloaded installer file.
 *
 * Unlike raw `verifyChecksum`, this adds:
 * - File-size zero check (catches empty/corrupt downloads)
 * - Structured logging with timing
 * - Better error messages for the installation pipeline
 */
export async function verifyInstaller(
  filePath: string,
  expectedSha256: string,
  logger: Logger,
): Promise<VerificationResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Installer file not found: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    throw new Error(
      `Installer file is empty (0 bytes): ${filePath}. ` +
        "The download may have failed silently.",
    );
  }

  logger.debug(
    { file: filePath, sizeBytes: stat.size },
    "Verifying installer checksum",
  );

  const startMs = Date.now();
  const result = await verifyChecksum(filePath, expectedSha256);
  const elapsedMs = Date.now() - startMs;

  if (result.valid) {
    logger.info(
      { sha256: result.actual, ms: elapsedMs },
      "Installer checksum verified",
    );
  } else {
    logger.error(
      { expected: result.expected, actual: result.actual, ms: elapsedMs },
      "Installer checksum MISMATCH",
    );
  }

  return result;
}
