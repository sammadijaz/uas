/**
 * UAS Engine — SHA-256 Checksum Verification
 *
 * Verifies downloaded file integrity against the checksum declared in the recipe.
 * This is a critical security boundary — see /docs/security-model.md.
 */

import * as fs from "fs";
import * as crypto from "crypto";

export interface VerificationResult {
  valid: boolean;
  expected: string;
  actual: string;
  file_path: string;
}

/**
 * Compute SHA-256 hash of a file.
 *
 * Uses streaming to handle large files without loading them into memory.
 */
export async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) =>
      reject(new Error(`Failed to read file for hashing: ${err.message}`)),
    );
  });
}

/**
 * Verify a file's SHA-256 checksum against an expected value.
 *
 * @param filePath - Absolute path to the file
 * @param expectedHash - Expected SHA-256 hex string (64 chars, lowercase)
 * @returns Verification result with both expected and actual hashes
 */
export async function verifyChecksum(
  filePath: string,
  expectedHash: string,
): Promise<VerificationResult> {
  const normalizedExpected = expectedHash.toLowerCase().trim();

  if (!/^[a-f0-9]{64}$/.test(normalizedExpected)) {
    throw new Error(
      `Invalid SHA-256 hash format: "${expectedHash}". Expected 64 hex characters.`,
    );
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const actual = await computeFileHash(filePath);

  return {
    valid: actual === normalizedExpected,
    expected: normalizedExpected,
    actual,
    file_path: filePath,
  };
}
