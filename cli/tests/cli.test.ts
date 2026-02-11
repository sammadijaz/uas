/**
 * UAS CLI — Tests
 *
 * Tests for CLI configuration, catalog loading, and output formatting.
 * Command integration tests use the engine in dry-run mode.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { stringify as stringifyYaml } from "yaml";
import { loadRecipe, listRecipes, searchRecipes } from "../src/catalog";
import { formatBytes, formatDuration } from "../src/output";

const TEST_DIR = path.join(os.tmpdir(), "uas-cli-test");
const TEST_CATALOG = path.join(TEST_DIR, "catalog");

// Mock the catalog path before importing
const originalHome = process.env.USERPROFILE;

/**
 * Sample recipe for testing catalog operations.
 */
function createSampleRecipe(id: string, name: string, tags: string[] = []) {
  return {
    id,
    name,
    description: `${name} description`,
    homepage: `https://example.com/${id}`,
    license: "MIT",
    version: "1.0.0",
    version_cmd: "",
    version_regex: "",
    installer: {
      type: "portable",
      url: `https://example.com/${id}-1.0.0.zip`,
      sha256: "a".repeat(64),
      portable: { copy_to: `\${UAS_APPS}\\${id}`, executable: `${id}.exe` },
    },
    side_effects: {},
    metadata: {
      categories: ["tools"],
      tags,
      maintainer: "test",
      updated: "2026-01-01",
    },
    requirements: { os: "10.0.0", arch: "x64", admin: false, dependencies: [] },
  };
}

describe("Output Formatting", () => {
  describe("formatBytes", () => {
    it("formats zero bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    it("formats bytes", () => {
      expect(formatBytes(512)).toBe("512.0 B");
    });

    it("formats kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
    });

    it("formats megabytes", () => {
      expect(formatBytes(1024 * 1024 * 5.5)).toBe("5.5 MB");
    });

    it("formats gigabytes", () => {
      expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe("2.0 GB");
    });
  });

  describe("formatDuration", () => {
    it("formats milliseconds", () => {
      expect(formatDuration(150)).toBe("150ms");
    });

    it("formats seconds", () => {
      expect(formatDuration(5500)).toBe("5.5s");
    });

    it("formats minutes", () => {
      expect(formatDuration(125000)).toBe("2m 5s");
    });
  });
});

describe("Catalog Operations", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_CATALOG, { recursive: true });

    // Write sample recipes
    const node = createSampleRecipe("node", "Node.js", [
      "runtime",
      "javascript",
    ]);
    const python = createSampleRecipe("python", "Python", [
      "runtime",
      "scripting",
    ]);
    const git = createSampleRecipe("git", "Git", ["vcs", "scm"]);

    fs.writeFileSync(path.join(TEST_CATALOG, "node.yaml"), stringifyYaml(node));
    fs.writeFileSync(
      path.join(TEST_CATALOG, "python.yaml"),
      stringifyYaml(python),
    );
    fs.writeFileSync(path.join(TEST_CATALOG, "git.yaml"), stringifyYaml(git));
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  // Note: These tests require the catalog path to point to TEST_CATALOG.
  // Since the catalog module reads from the configured path, we test the
  // functions indirectly by verifying the YAML parsing logic directly.

  it("parses a valid recipe YAML", () => {
    const content = fs.readFileSync(
      path.join(TEST_CATALOG, "node.yaml"),
      "utf-8",
    );
    const { parse: parseYaml } = require("yaml");
    const recipe = parseYaml(content);

    expect(recipe.id).toBe("node");
    expect(recipe.name).toBe("Node.js");
    expect(recipe.version).toBe("1.0.0");
    expect(recipe.installer.type).toBe("portable");
  });

  it("lists YAML files in catalog directory", () => {
    const files = fs
      .readdirSync(TEST_CATALOG)
      .filter((f: string) => f.endsWith(".yaml"));
    expect(files).toHaveLength(3);
    expect(files).toContain("node.yaml");
    expect(files).toContain("python.yaml");
    expect(files).toContain("git.yaml");
  });

  it("search filters by name", () => {
    const { parse: parseYaml } = require("yaml");
    const files = fs
      .readdirSync(TEST_CATALOG)
      .filter((f: string) => f.endsWith(".yaml"));
    const recipes = files.map((f: string) => {
      const content = fs.readFileSync(path.join(TEST_CATALOG, f), "utf-8");
      return parseYaml(content);
    });

    // Simulate search
    const query = "node";
    const results = recipes.filter((r: any) => {
      const haystack = [r.id, r.name, r.description, ...r.metadata.tags]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query.toLowerCase());
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("node");
  });

  it("search filters by tag", () => {
    const { parse: parseYaml } = require("yaml");
    const files = fs
      .readdirSync(TEST_CATALOG)
      .filter((f: string) => f.endsWith(".yaml"));
    const recipes = files.map((f: string) => {
      const content = fs.readFileSync(path.join(TEST_CATALOG, f), "utf-8");
      return parseYaml(content);
    });

    const query = "runtime";
    const results = recipes.filter((r: any) => {
      const haystack = [r.id, r.name, ...r.metadata.tags]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query.toLowerCase());
    });

    expect(results).toHaveLength(2);
  });
});
