/**
 * UAS Engine — Checksum Verifier Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";
import { verifyChecksum, computeFileHash } from "../src/verifier";

const TEST_DIR = path.join(os.tmpdir(), "uas-verifier-test");
const TEST_FILE = path.join(TEST_DIR, "test-file.txt");
const TEST_CONTENT = "Hello, UAS verifier test!";

let expectedHash: string;

beforeAll(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.writeFileSync(TEST_FILE, TEST_CONTENT, "utf-8");
  expectedHash = crypto.createHash("sha256").update(TEST_CONTENT).digest("hex");
});

afterAll(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("computeFileHash", () => {
  it("computes correct SHA-256 hash", async () => {
    const hash = await computeFileHash(TEST_FILE);
    expect(hash).toBe(expectedHash);
  });

  it("throws for non-existent file", async () => {
    await expect(computeFileHash("/nonexistent/file.txt")).rejects.toThrow();
  });
});

describe("verifyChecksum", () => {
  it("returns valid: true for matching checksum", async () => {
    const result = await verifyChecksum(TEST_FILE, expectedHash);
    expect(result.valid).toBe(true);
    expect(result.expected).toBe(expectedHash);
    expect(result.actual).toBe(expectedHash);
  });

  it("returns valid: false for mismatched checksum", async () => {
    const wrongHash = "a".repeat(64);
    const result = await verifyChecksum(TEST_FILE, wrongHash);
    expect(result.valid).toBe(false);
    expect(result.expected).toBe(wrongHash);
    expect(result.actual).toBe(expectedHash);
  });

  it("handles uppercase hash input (normalizes to lowercase)", async () => {
    const upperHash = expectedHash.toUpperCase();
    const result = await verifyChecksum(TEST_FILE, upperHash);
    expect(result.valid).toBe(true);
  });

  it("throws for invalid hash format", async () => {
    await expect(verifyChecksum(TEST_FILE, "not-a-hash")).rejects.toThrow(
      "Invalid SHA-256",
    );
  });

  it("throws for non-existent file", async () => {
    await expect(verifyChecksum("/nonexistent", expectedHash)).rejects.toThrow(
      "File not found",
    );
  });
});
