/**
 * UAS Engine — Windows Pipeline Tests
 *
 * Tests for the new modular windows/ pipeline:
 * - MSI exit code mapping
 * - MSI argument building (quoting, properties)
 * - Smart download (cache decision logic)
 * - Installation detection (state file, version command)
 * - State file read/write
 * - Installer verification
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import {
  lookupMsiExitCode,
  MSI_EXIT_CODES,
} from "../src/windows/types";
import { buildMsiArgs } from "../src/windows/msi";
import { evaluateDownload } from "../src/windows/download";
import { verifyInstaller } from "../src/windows/verify";
import {
  readAppState,
  writeAppState,
  removeAppState,
  getStateFilePath,
} from "../src/windows/detectInstalled";
import type { AppStateFile } from "../src/windows/types";
import { createLogger } from "../src/utils/logger";

const TEST_DIR = path.join(os.tmpdir(), "uas-windows-test");
const logger = createLogger({ level: "error" });

// ────────────────────────────────────────────────────────────────
// MSI Exit Code Mapping
// ────────────────────────────────────────────────────────────────

describe("MSI Exit Codes", () => {
  it("maps code 0 to success", () => {
    const info = lookupMsiExitCode(0);
    expect(info.ok).toBe(true);
    expect(info.category).toBe("success");
    expect(info.name).toBe("ERROR_SUCCESS");
  });

  it("maps code 3010 to success (reboot required)", () => {
    const info = lookupMsiExitCode(3010);
    expect(info.ok).toBe(true);
    expect(info.category).toBe("success");
    expect(info.name).toBe("ERROR_SUCCESS_REBOOT_REQUIRED");
  });

  it("maps code 1641 to success (reboot initiated)", () => {
    const info = lookupMsiExitCode(1641);
    expect(info.ok).toBe(true);
    expect(info.category).toBe("success");
  });

  it("maps code 1639 to invalid arguments", () => {
    const info = lookupMsiExitCode(1639);
    expect(info.ok).toBe(false);
    expect(info.category).toBe("args");
    expect(info.name).toBe("ERROR_INVALID_COMMAND_LINE");
  });

  it("maps code 1603 to fatal error", () => {
    const info = lookupMsiExitCode(1603);
    expect(info.ok).toBe(false);
    expect(info.category).toBe("fatal");
  });

  it("maps code 1618 to busy (another install running)", () => {
    const info = lookupMsiExitCode(1618);
    expect(info.ok).toBe(false);
    expect(info.category).toBe("busy");
  });

  it("maps code 1602 to user cancelled", () => {
    const info = lookupMsiExitCode(1602);
    expect(info.ok).toBe(false);
    expect(info.category).toBe("fatal");
  });

  it("returns unknown for unrecognised codes", () => {
    const info = lookupMsiExitCode(9999);
    expect(info.ok).toBe(false);
    expect(info.category).toBe("unknown");
    expect(info.name).toBe("UNKNOWN");
  });

  it("has all documented codes in the map", () => {
    const expectedCodes = [0, 1602, 1603, 1618, 1619, 1620, 1639, 1641, 3010];
    for (const code of expectedCodes) {
      expect(MSI_EXIT_CODES[code]).toBeDefined();
    }
  });
});

// ────────────────────────────────────────────────────────────────
// MSI Argument Building
// ────────────────────────────────────────────────────────────────

describe("buildMsiArgs", () => {
  it("produces /i /qn /norestart /l*v flags", () => {
    const { args } = buildMsiArgs({
      msiPath: "C:\\test\\app.msi",
      appId: "test",
      displayName: "Test v1.0",
      dryRun: false,
      logger,
    });

    expect(args).toContain("/i");
    expect(args).toContain("/qn");
    expect(args).toContain("/norestart");
    expect(args.some((a) => a.startsWith("/l*v"))).toBe(true);
    expect(args).toContain("C:\\test\\app.msi");
  });

  it("quotes INSTALLDIR with spaces correctly", () => {
    const { args } = buildMsiArgs({
      msiPath: "C:\\test\\app.msi",
      installDirOverride: "C:\\Program Files\\My App",
      appId: "test",
      displayName: "Test v1.0",
      dryRun: false,
      logger,
    });

    const installDirArg = args.find((a) => a.startsWith("INSTALLDIR="));
    expect(installDirArg).toBeDefined();
    expect(installDirArg).toBe('INSTALLDIR="C:\\Program Files\\My App"');
  });

  it("resolves variables in properties", () => {
    const { args } = buildMsiArgs({
      msiPath: "C:\\test\\app.msi",
      properties: { MYDIR: "${USERPROFILE}\\myapp" },
      appId: "test",
      displayName: "Test v1.0",
      dryRun: false,
      logger,
    });

    const myDirArg = args.find((a) => a.startsWith("MYDIR="));
    expect(myDirArg).toBeDefined();
    // Should contain resolved path, not ${USERPROFILE}
    expect(myDirArg).not.toContain("${USERPROFILE}");
    expect(myDirArg).toContain(os.homedir());
  });

  it("override takes precedence over properties for INSTALLDIR", () => {
    const { args } = buildMsiArgs({
      msiPath: "C:\\test\\app.msi",
      properties: { INSTALLDIR: "C:\\Old\\Path" },
      installDirOverride: "D:\\New\\Path",
      appId: "test",
      displayName: "Test v1.0",
      dryRun: false,
      logger,
    });

    const installDirArgs = args.filter((a) => a.startsWith("INSTALLDIR="));
    // Should only have ONE INSTALLDIR, the override
    expect(installDirArgs.length).toBe(1);
    expect(installDirArgs[0]).toBe('INSTALLDIR="D:\\New\\Path"');
  });

  it("generates a log file path", () => {
    const { logFile } = buildMsiArgs({
      msiPath: "C:\\test\\app.msi",
      appId: "my-app",
      displayName: "My App v1.0",
      dryRun: false,
      logger,
    });

    expect(logFile).toContain("msi-my-app-");
    expect(logFile).toContain(".log");
  });

  it("does not double-quote already-quoted values", () => {
    const { args } = buildMsiArgs({
      msiPath: "C:\\test\\app.msi",
      installDirOverride: '"C:\\Program Files\\App"',
      appId: "test",
      displayName: "Test v1.0",
      dryRun: false,
      logger,
    });

    const installDirArg = args.find((a) => a.startsWith("INSTALLDIR="));
    expect(installDirArg).toBe('INSTALLDIR="C:\\Program Files\\App"');
    // No double-double quotes
    expect(installDirArg).not.toContain('""');
  });
});

// ────────────────────────────────────────────────────────────────
// Smart Download (evaluateDownload)
// ────────────────────────────────────────────────────────────────

describe("evaluateDownload", () => {
  const testFile = path.join(TEST_DIR, "download", "test-installer.msi");

  beforeEach(() => {
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("returns needed=true when file does not exist", async () => {
    const decision = await evaluateDownload(testFile, "a".repeat(64), logger);
    expect(decision.needed).toBe(true);
  });

  it("returns needed=false when file exists with matching checksum", async () => {
    const content = "hello world installer content";
    fs.writeFileSync(testFile, content);
    const hash = crypto.createHash("sha256").update(content).digest("hex");

    const decision = await evaluateDownload(testFile, hash, logger);
    expect(decision.needed).toBe(false);
    expect(decision.reason).toBe("cached_valid");
  });

  it("returns needed=true and deletes file when checksum mismatches", async () => {
    fs.writeFileSync(testFile, "old content");
    const wrongHash = "b".repeat(64);

    const decision = await evaluateDownload(testFile, wrongHash, logger);
    expect(decision.needed).toBe(true);
    expect(decision.reason).toBe("exists_mismatch_redownload");
    // File should have been deleted
    expect(fs.existsSync(testFile)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// Installer Verification
// ────────────────────────────────────────────────────────────────

describe("verifyInstaller", () => {
  const testFile = path.join(TEST_DIR, "verify", "installer.msi");

  beforeEach(() => {
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("accepts a file with matching checksum", async () => {
    const content = "valid installer bytes";
    fs.writeFileSync(testFile, content);
    const expectedHash = crypto.createHash("sha256").update(content).digest("hex");

    const result = await verifyInstaller(testFile, expectedHash, logger);
    expect(result.valid).toBe(true);
    expect(result.actual).toBe(expectedHash);
  });

  it("rejects a file with wrong checksum", async () => {
    fs.writeFileSync(testFile, "some content");
    const result = await verifyInstaller(testFile, "a".repeat(64), logger);
    expect(result.valid).toBe(false);
  });

  it("throws for missing file", async () => {
    await expect(
      verifyInstaller("/nonexistent/file.msi", "a".repeat(64), logger),
    ).rejects.toThrow("not found");
  });

  it("throws for empty file", async () => {
    fs.writeFileSync(testFile, "");
    await expect(
      verifyInstaller(testFile, "a".repeat(64), logger),
    ).rejects.toThrow("empty");
  });
});

// ────────────────────────────────────────────────────────────────
// App State File
// ────────────────────────────────────────────────────────────────

describe("App State File", () => {
  // Override HOME to use test dir so we don't pollute the real ~/.uas/state
  const originalHome = process.env.USERPROFILE;
  const originalHomePath = process.env.HOME;

  beforeEach(() => {
    // State files use os.homedir() internally, which reads USERPROFILE on Windows
    // We can't easily override that, so we test read/write/remove with the real paths
    // but use a unique app ID to avoid collisions
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up any test state files
    try {
      removeAppState("uas-test-unique-app-xyz");
    } catch {
      /* ignore */
    }
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("returns null for non-existent state file", () => {
    const state = readAppState("nonexistent-app-zzz");
    expect(state).toBeNull();
  });

  it("writes and reads state correctly", () => {
    const appId = "uas-test-unique-app-xyz";
    const stateData: AppStateFile = {
      version: "1.2.3",
      installedAt: "2026-02-11T00:00:00Z",
      installerPath: "C:\\downloads\\app.msi",
      checksum: "a".repeat(64),
      method: "msi",
      installDir: "C:\\Program Files\\TestApp",
    };

    writeAppState(appId, stateData);
    const read = readAppState(appId);

    expect(read).toBeDefined();
    expect(read!.version).toBe("1.2.3");
    expect(read!.method).toBe("msi");
    expect(read!.installDir).toBe("C:\\Program Files\\TestApp");

    // Clean up
    removeAppState(appId);
    expect(readAppState(appId)).toBeNull();
  });

  it("getStateFilePath returns a path under .uas/state/", () => {
    const p = getStateFilePath("my-app");
    expect(p).toContain(".uas");
    expect(p).toContain("state");
    expect(p).toContain("my-app.json");
  });
});
