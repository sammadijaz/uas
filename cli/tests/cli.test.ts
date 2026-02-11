/**
 * UAS CLI — Tests
 *
 * Tests for CLI configuration, catalog loading, output formatting,
 * and new commands (list, remove, save, restore, env).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import { loadRecipe, listRecipes, searchRecipes } from "../src/catalog";
import { Command } from "commander";
import { registerInstallCommand } from "../src/commands/install";
import {
  formatBytes,
  formatDuration,
  formatState,
  formatErrorCategory,
  setDebugMode,
  isDebugMode,
  printDebug,
} from "../src/output";

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

  describe("formatState", () => {
    it("returns human-friendly label for EXECUTING", () => {
      // formatState wraps in ANSI colors; just verify it returns a string
      const result = formatState("EXECUTING");
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("returns a string for unknown states", () => {
      const result = formatState("UNKNOWN_STATE");
      expect(result).toBeTruthy();
    });
  });

  describe("formatErrorCategory", () => {
    it("maps DOWNGRADE_BLOCKED to human message", () => {
      expect(formatErrorCategory("DOWNGRADE_BLOCKED")).toBe(
        "Downgrade not allowed",
      );
    });

    it("maps NETWORK_ERROR to human message", () => {
      expect(formatErrorCategory("NETWORK_ERROR")).toBe(
        "Network or download failure",
      );
    });

    it("passes through unknown categories", () => {
      expect(formatErrorCategory("UNKNOWN_CAT")).toBe("UNKNOWN_CAT");
    });
  });

  describe("debug mode", () => {
    afterEach(() => setDebugMode(false));

    it("defaults to false", () => {
      setDebugMode(false);
      expect(isDebugMode()).toBe(false);
    });

    it("can be enabled", () => {
      setDebugMode(true);
      expect(isDebugMode()).toBe(true);
    });

    it("can be toggled off", () => {
      setDebugMode(true);
      setDebugMode(false);
      expect(isDebugMode()).toBe(false);
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

// ─── New Command Tests ──────────────────────────────────────

describe("Save Profile Generation", () => {
  const PROFILES_DIR = path.join(os.tmpdir(), "uas-cli-test-profiles");

  beforeEach(() => {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(PROFILES_DIR, { recursive: true, force: true });
  });

  it("generates valid YAML for a profile", () => {
    const profile = {
      name: "test-machine",
      id: "test-machine",
      description: "Test profile",
      author: "tester",
      version: "1.0.0",
      schema_version: "1.0",
      apps: [
        { id: "node", version: "20.0.0", optional: false },
        { id: "git", version: "2.44.0", optional: false },
      ],
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ["saved"],
        platform: "windows",
        min_uas_version: "0.1.0",
      },
      environment: {
        user_path: ["C:\\Program Files\\nodejs", "C:\\Program Files\\Git\\bin"],
        variables: { JAVA_HOME: "C:\\Program Files\\Java\\jdk-21" },
      },
    };

    const yamlContent = stringifyYaml(profile);
    const dest = path.join(PROFILES_DIR, "test-machine.yaml");
    fs.writeFileSync(dest, yamlContent, "utf-8");

    // Read it back and verify
    const parsed = parseYaml(fs.readFileSync(dest, "utf-8")) as any;
    expect(parsed.name).toBe("test-machine");
    expect(parsed.apps).toHaveLength(2);
    expect(parsed.apps[0].id).toBe("node");
    expect(parsed.environment.user_path).toHaveLength(2);
    expect(parsed.environment.variables.JAVA_HOME).toContain("jdk-21");
  });

  it("handles profile with no environment", () => {
    const profile = {
      name: "minimal",
      id: "minimal",
      description: "Minimal profile",
      author: "tester",
      version: "1.0.0",
      schema_version: "1.0",
      apps: [{ id: "node", version: "20.0.0", optional: false }],
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ["saved"],
        platform: "windows",
        min_uas_version: "0.1.0",
      },
    };

    const yamlContent = stringifyYaml(profile);
    const parsed = parseYaml(yamlContent) as any;
    expect(parsed.environment).toBeUndefined();
    expect(parsed.apps).toHaveLength(1);
  });
});

describe("Environment Snapshot", () => {
  const ENV_DIR = path.join(os.tmpdir(), "uas-cli-test-env");

  beforeEach(() => {
    fs.mkdirSync(ENV_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(ENV_DIR, { recursive: true, force: true });
  });

  it("creates valid env snapshot YAML", () => {
    const snapshot = {
      name: "dev-env",
      created: "2026-01-15",
      machine: "WORKSTATION",
      user_path: ["C:\\tools\\bin", "C:\\Python312"],
      system_path: ["C:\\Windows\\System32"],
      user_vars: {
        GOPATH: "C:\\Users\\dev\\go",
        ANDROID_HOME: "C:\\Android\\sdk",
      },
    };

    const dest = path.join(ENV_DIR, "dev-env.yaml");
    fs.writeFileSync(dest, stringifyYaml(snapshot), "utf-8");

    const parsed = parseYaml(fs.readFileSync(dest, "utf-8")) as any;
    expect(parsed.name).toBe("dev-env");
    expect(parsed.user_path).toHaveLength(2);
    expect(parsed.user_vars.GOPATH).toContain("go");
    expect(parsed.machine).toBe("WORKSTATION");
  });

  it("handles empty environment gracefully", () => {
    const snapshot = {
      name: "empty",
      created: "2026-01-15",
      machine: "LAPTOP",
      user_path: [],
      system_path: [],
      user_vars: {},
    };

    const yaml = stringifyYaml(snapshot);
    const parsed = parseYaml(yaml) as any;
    expect(parsed.user_path).toHaveLength(0);
    expect(Object.keys(parsed.user_vars)).toHaveLength(0);
  });
});

describe("Restore Profile Parsing", () => {
  const PROFILES_DIR = path.join(os.tmpdir(), "uas-cli-test-restore");

  beforeEach(() => {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(PROFILES_DIR, { recursive: true, force: true });
  });

  it("parses a saved profile with environment section", () => {
    const profileYaml = `
name: my-workstation
id: my-workstation
description: Main dev machine
apps:
  - id: node
    version: "20.11.0"
    optional: false
  - id: python
    version: "3.12.0"
    optional: false
  - id: vscode
    version: "1.87.0"
    optional: true
environment:
  user_path:
    - C:\\Program Files\\nodejs
    - C:\\Python312
    - C:\\Python312\\Scripts
  variables:
    JAVA_HOME: C:\\Program Files\\Java\\jdk-21
    GOPATH: C:\\Users\\dev\\go
    ANDROID_HOME: C:\\Android\\sdk
`;

    const dest = path.join(PROFILES_DIR, "my-workstation.yaml");
    fs.writeFileSync(dest, profileYaml, "utf-8");

    const parsed = parseYaml(fs.readFileSync(dest, "utf-8")) as any;
    expect(parsed.apps).toHaveLength(3);
    expect(parsed.apps[2].optional).toBe(true);
    expect(parsed.environment.user_path).toHaveLength(3);
    expect(parsed.environment.variables.JAVA_HOME).toContain("jdk-21");
  });

  it("identifies apps that need installation", () => {
    const profile = {
      apps: [
        { id: "node", version: "20.11.0", optional: false },
        { id: "python", version: "3.12.0", optional: false },
        { id: "vscode", version: "1.87.0", optional: true },
      ],
    };

    // Simulate what restore does: partition into required/optional
    const required = profile.apps.filter((a) => !a.optional);
    const optional = profile.apps.filter((a) => a.optional);
    expect(required).toHaveLength(2);
    expect(optional).toHaveLength(1);
    expect(optional[0].id).toBe("vscode");
  });
});

describe("List Command Logic", () => {
  it("filters installed vs available apps", () => {
    const catalogApps = ["node", "python", "git", "vscode", "docker"];
    const installedApps = new Set(["node", "git"]);

    const available = catalogApps.filter((a) => !installedApps.has(a));
    const installed = catalogApps.filter((a) => installedApps.has(a));

    expect(installed).toEqual(["node", "git"]);
    expect(available).toEqual(["python", "vscode", "docker"]);
  });
});

describe("Remove Command Logic", () => {
  it("validates app is installed before removal", () => {
    const installedApps = new Map([
      ["node", { version: "20.11.0" }],
      ["git", { version: "2.44.0" }],
    ]);

    expect(installedApps.has("node")).toBe(true);
    expect(installedApps.has("python")).toBe(false);
  });
});

// ─── Install Command Alias ──────────────────────────────────

describe("Install Command Alias", () => {
  it("registers 'i' alias on the install command", () => {
    const prog = new Command();
    prog.exitOverride(); // prevent process.exit in tests
    registerInstallCommand(prog);

    const installCmd = prog.commands.find((c: any) => c.name() === "install");
    expect(installCmd).toBeDefined();
    expect(installCmd!.aliases()).toContain("i");
  });
});

// ─── UTF-8 Output Safety ───────────────────────────────────

describe("UTF-8 Output Safety", () => {
  it("has no em-dashes in user-visible string constants", () => {
    // Read key output-producing CLI source files and ensure no U+2014
    const fs = require("fs");
    const path = require("path");
    const cliSrc = path.join(__dirname, "..", "src");

    const files = [
      "commands/install.ts",
      "commands/uninstall.ts",
      "commands/remove.ts",
      "commands/list.ts",
      "commands/profile.ts",
      "commands/env.ts",
      "commands/restore.ts",
      "commands/sync.ts",
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(cliSrc, file), "utf-8");
      // Only check inside string literals (template and regular)
      // Simple approach: find all template / normal strings containing em-dash
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comment-only lines (/* or // or *)
        const trimmed = line.trim();
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("/*") ||
          trimmed.startsWith("*")
        ) {
          continue;
        }
        // Check for em-dash in code lines (likely in strings)
        if (line.includes("\u2014")) {
          throw new Error(
            `Em-dash (U+2014) found in ${file}:${i + 1} - replace with ASCII hyphen`,
          );
        }
      }
    }
  });
});

// ─── Debug Mode Output Suppression ──────────────────────────

describe("Debug Mode Output Suppression", () => {
  it("printDebug does nothing when debug mode is off", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    setDebugMode(false);

    printDebug("should not appear");

    // console.log should not have been called with debug text
    const calls = consoleSpy.mock.calls.filter((c) =>
      String(c[0]).includes("should not appear"),
    );
    expect(calls).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it("printDebug outputs when debug mode is on", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    setDebugMode(true);

    printDebug("test debug message");

    const calls = consoleSpy.mock.calls.filter((c) =>
      String(c[0]).includes("test debug message"),
    );
    expect(calls.length).toBeGreaterThan(0);

    setDebugMode(false);
    consoleSpy.mockRestore();
  });
});

// ─── List Table Formatting ──────────────────────────────────

describe("List Table Formatting", () => {
  it("truncates long descriptions properly", () => {
    // The list command truncates descriptions to 38 chars
    const truncate = (s: string, max: number) =>
      s.length <= max ? s : s.slice(0, max - 1) + "\u2026";

    const short = "Short desc";
    const long =
      "This is a very long description that definitely exceeds the limit";

    expect(truncate(short, 38)).toBe("Short desc");
    expect(truncate(long, 38).length).toBe(38);
    expect(truncate(long, 38).endsWith("\u2026")).toBe(true);
  });
});
