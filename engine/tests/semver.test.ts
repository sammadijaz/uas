/**
 * UAS Engine -- Semver Utility Tests
 *
 * Tests for version normalization, parsing, comparison,
 * and downgrade/upgrade classification.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeSemver,
  parseSemver,
  compareSemver,
  isValidSemver,
  classifyVersionChange,
} from "../src/utils/semver";

// ────────────────────────────────────────────────────────────────
// normalizeSemver
// ────────────────────────────────────────────────────────────────

describe("normalizeSemver", () => {
  it("strips leading v prefix", () => {
    expect(normalizeSemver("v1.2.3")).toBe("1.2.3");
  });

  it("strips leading V prefix (uppercase)", () => {
    expect(normalizeSemver("V24.12.0")).toBe("24.12.0");
  });

  it("trims whitespace", () => {
    expect(normalizeSemver("  1.2.3  ")).toBe("1.2.3");
  });

  it("handles combined v prefix and whitespace", () => {
    expect(normalizeSemver(" v3.0.0 ")).toBe("3.0.0");
  });

  it("passes through plain version unchanged", () => {
    expect(normalizeSemver("22.11.0")).toBe("22.11.0");
  });
});

// ────────────────────────────────────────────────────────────────
// parseSemver
// ────────────────────────────────────────────────────────────────

describe("parseSemver", () => {
  it("parses standard X.Y.Z format", () => {
    const result = parseSemver("1.2.3");
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      normalized: "1.2.3",
    });
  });

  it("parses version with v prefix", () => {
    const result = parseSemver("v22.11.0");
    expect(result).toEqual({
      major: 22,
      minor: 11,
      patch: 0,
      normalized: "22.11.0",
    });
  });

  it("defaults patch to 0 for X.Y format", () => {
    const result = parseSemver("1.0");
    expect(result).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      normalized: "1.0",
    });
  });

  it("handles large version numbers", () => {
    const result = parseSemver("2025.1.15");
    expect(result).toEqual({
      major: 2025,
      minor: 1,
      patch: 15,
      normalized: "2025.1.15",
    });
  });

  it("returns null for empty string", () => {
    expect(parseSemver("")).toBeNull();
  });

  it("returns null for non-version strings", () => {
    expect(parseSemver("not-a-version")).toBeNull();
  });

  it("returns null for single number", () => {
    expect(parseSemver("42")).toBeNull();
  });

  it("returns null for prerelease tags", () => {
    // We intentionally don't handle prerelease — returns null
    expect(parseSemver("1.0.0-beta.1")).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────
// compareSemver
// ────────────────────────────────────────────────────────────────

describe("compareSemver", () => {
  it("returns 0 for equal versions", () => {
    expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
  });

  it("returns 0 for equal versions with v prefix", () => {
    expect(compareSemver("v1.2.3", "1.2.3")).toBe(0);
  });

  it("returns 1 when a > b (major)", () => {
    expect(compareSemver("2.0.0", "1.0.0")).toBe(1);
  });

  it("returns -1 when a < b (major)", () => {
    expect(compareSemver("1.0.0", "2.0.0")).toBe(-1);
  });

  it("returns 1 when a > b (minor)", () => {
    expect(compareSemver("1.3.0", "1.2.0")).toBe(1);
  });

  it("returns -1 when a < b (minor)", () => {
    expect(compareSemver("1.2.0", "1.3.0")).toBe(-1);
  });

  it("returns 1 when a > b (patch)", () => {
    expect(compareSemver("1.2.4", "1.2.3")).toBe(1);
  });

  it("returns -1 when a < b (patch)", () => {
    expect(compareSemver("1.2.3", "1.2.4")).toBe(-1);
  });

  it("returns null for invalid a", () => {
    expect(compareSemver("garbage", "1.2.3")).toBeNull();
  });

  it("returns null for invalid b", () => {
    expect(compareSemver("1.2.3", "nope")).toBeNull();
  });

  it("handles X.Y format (patch defaults to 0)", () => {
    expect(compareSemver("1.0", "1.0.0")).toBe(0);
  });

  it("compares mixed v-prefix correctly", () => {
    expect(compareSemver("v22.11.0", "v24.12.0")).toBe(-1);
  });
});

// ────────────────────────────────────────────────────────────────
// isValidSemver
// ────────────────────────────────────────────────────────────────

describe("isValidSemver", () => {
  it("accepts standard semver", () => {
    expect(isValidSemver("1.2.3")).toBe(true);
  });

  it("accepts v-prefixed semver", () => {
    expect(isValidSemver("v3.14.2")).toBe(true);
  });

  it("accepts X.Y format", () => {
    expect(isValidSemver("1.0")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidSemver("")).toBe(false);
  });

  it("rejects garbage", () => {
    expect(isValidSemver("latest")).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// classifyVersionChange
// ────────────────────────────────────────────────────────────────

describe("classifyVersionChange", () => {
  it("classifies identical versions as same", () => {
    expect(classifyVersionChange("1.2.3", "1.2.3")).toBe("same");
  });

  it("classifies v-prefix match as same", () => {
    expect(classifyVersionChange("v22.11.0", "22.11.0")).toBe("same");
  });

  it("classifies newer target as upgrade", () => {
    expect(classifyVersionChange("22.11.0", "24.12.0")).toBe("upgrade");
  });

  it("classifies older target as downgrade", () => {
    expect(classifyVersionChange("24.12.0", "22.11.0")).toBe("downgrade");
  });

  it("classifies unparseable versions as unknown", () => {
    expect(classifyVersionChange("latest", "1.0.0")).toBe("unknown");
  });

  it("classifies minor upgrade correctly", () => {
    expect(classifyVersionChange("1.2.0", "1.3.0")).toBe("upgrade");
  });

  it("classifies minor downgrade correctly", () => {
    expect(classifyVersionChange("1.3.0", "1.2.0")).toBe("downgrade");
  });

  it("classifies patch upgrade correctly", () => {
    expect(classifyVersionChange("1.2.3", "1.2.4")).toBe("upgrade");
  });

  it("classifies patch downgrade correctly", () => {
    expect(classifyVersionChange("1.2.4", "1.2.3")).toBe("downgrade");
  });
});
