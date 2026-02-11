/**
 * UAS Engine — Integration Tests
 *
 * These tests verify the engine's lifecycle against the spec.
 * They use a temporary state database and mock recipes.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { UASEngine } from "../src/engine";
import { InstallRecipe, EngineOptions, ExecutionState } from "../src/types";

const TEST_DIR = path.join(os.tmpdir(), "uas-engine-test");

function createTestOptions(): EngineOptions {
  return {
    state_db_path: path.join(TEST_DIR, "state.db"),
    catalog_path: path.join(TEST_DIR, "catalog"),
    download_dir: path.join(TEST_DIR, "downloads"),
    dry_run: false,
    verbose: false,
  };
}

/**
 * A minimal valid recipe for testing validation logic.
 * The URL won't actually resolve, so tests using this for real installs
 * need to either use dry_run or mock the download.
 */
function createTestRecipe(
  overrides: Partial<InstallRecipe> = {},
): InstallRecipe {
  return {
    id: "test-app",
    name: "Test Application",
    description: "A test application",
    homepage: "https://example.com",
    license: "MIT",
    version: "1.0.0",
    version_cmd: "",
    version_regex: "",
    installer: {
      type: "portable",
      url: "https://example.com/test-app-1.0.0.exe",
      sha256: "a".repeat(64),
      portable: {
        copy_to: "${UAS_APPS}\\test-app",
        executable: "test-app.exe",
      },
    },
    side_effects: {},
    metadata: {
      categories: ["testing"],
      tags: ["test"],
      maintainer: "test",
      updated: "2026-01-01",
    },
    requirements: {
      os: "10.0.0",
      arch: "x64",
      admin: false,
      dependencies: [],
    },
    ...overrides,
  };
}

describe("UASEngine", () => {
  let engine: UASEngine;

  beforeEach(async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    engine = new UASEngine(createTestOptions());
    await engine.init();
  });

  afterEach(() => {
    engine.close();
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("validateRecipe", () => {
    it("accepts a valid recipe", () => {
      const recipe = createTestRecipe();
      const errors = engine.validateRecipe(recipe);
      expect(errors).toEqual([]);
    });

    it("rejects HTTP URLs", () => {
      const recipe = createTestRecipe({
        installer: {
          type: "portable",
          url: "http://insecure.com/test.exe",
          sha256: "a".repeat(64),
          portable: { copy_to: "${UAS_APPS}\\test", executable: "test.exe" },
        },
      });
      const errors = engine.validateRecipe(recipe);
      expect(errors.some((e) => e.includes("HTTPS"))).toBe(true);
    });

    it("rejects invalid SHA-256 hash", () => {
      const recipe = createTestRecipe({
        installer: {
          type: "portable",
          url: "https://example.com/test.exe",
          sha256: "not-a-valid-hash",
          portable: { copy_to: "${UAS_APPS}\\test", executable: "test.exe" },
        },
      });
      const errors = engine.validateRecipe(recipe);
      expect(errors.some((e) => e.includes("SHA-256"))).toBe(true);
    });

    it("rejects invalid architecture", () => {
      const recipe = createTestRecipe({
        requirements: {
          os: "10.0.0",
          arch: "mips" as never,
          admin: false,
          dependencies: [],
        },
      });
      const errors = engine.validateRecipe(recipe);
      expect(errors.some((e) => e.includes("architecture"))).toBe(true);
    });

    it("validates executor-specific requirements", () => {
      const recipe = createTestRecipe({
        installer: {
          type: "exe",
          url: "https://example.com/test.exe",
          sha256: "a".repeat(64),
          // Missing .exe options
        },
      });
      const errors = engine.validateRecipe(recipe);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("state management", () => {
    it("reports no apps installed initially", () => {
      expect(engine.getInstalledApps()).toEqual([]);
    });

    it("reports app not installed", () => {
      expect(engine.isInstalled("node")).toBe(false);
    });
  });

  describe("event system", () => {
    it("emits state_change events during dry-run install", async () => {
      const events: ExecutionState[] = [];
      engine.on((event) => {
        if (event.type === "state_change") {
          events.push((event.data as { state: ExecutionState }).state);
        }
      });

      const recipe = createTestRecipe();
      await engine.install(recipe, { dry_run: true });

      expect(events).toContain("PENDING");
      expect(events).toContain("VALIDATING");
    });
  });
});
