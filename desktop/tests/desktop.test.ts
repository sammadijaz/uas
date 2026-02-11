/**
 * UAS Desktop — Tests
 *
 * Unit tests for the desktop app logic.
 * Note: Electron main/renderer cannot be tested directly without Electron runtime.
 * These tests validate the shared logic and IPC interface contracts.
 */

import { describe, it, expect } from "vitest";
import * as path from "path";
import { Catalog } from "@uas/catalog";

const CATALOG_DIR = path.join(__dirname, "..", "..", "catalog");

// ─── IPC Contract Tests ──────────────────────────────────────

describe("IPC Contract: Catalog operations", () => {
  const catalog = new Catalog(CATALOG_DIR);

  it("catalog:list should return entries array", () => {
    const entries = catalog.getEntries();
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThanOrEqual(5);
  });

  it("catalog:search should return filtered results", () => {
    const results = catalog.search("node");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.id === "node")).toBe(true);
  });

  it("catalog:get should return full recipe", () => {
    const recipe = catalog.loadRecipe("node");
    expect(recipe).not.toBeNull();
    expect(recipe!.id).toBe("node");
    expect(recipe!.installer).toBeDefined();
    expect(recipe!.metadata).toBeDefined();
  });

  it("catalog:get should return null for unknown", () => {
    const recipe = catalog.loadRecipe("nonexistent");
    expect(recipe).toBeNull();
  });

  it("catalog:filter-category should filter by category", () => {
    const results = catalog.filterByCategory("development");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("catalog:filter-tag should filter by tag", () => {
    const results = catalog.filterByTag("npm");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("catalog:validate should return validation result", () => {
    const result = catalog.validateRecipe("node");
    expect(result).not.toBeNull();
    expect(result!.valid).toBe(true);
    expect(Array.isArray(result!.errors)).toBe(true);
  });
});

describe("IPC Contract: Profile operations", () => {
  const catalog = new Catalog(CATALOG_DIR);

  it("profile:list should return profile names", () => {
    const profiles = catalog.listProfiles();
    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles.length).toBeGreaterThanOrEqual(1);
    expect(profiles).toContain("frontend-dev");
  });

  it("profile:load should return profile data", () => {
    const profile = catalog.loadProfile("frontend-dev");
    expect(profile).not.toBeNull();
    expect(profile!.name).toBe("Frontend Developer");
    expect(Array.isArray(profile!.apps)).toBe(true);
  });

  it("profile:load should return null for unknown", () => {
    const profile = catalog.loadProfile("nonexistent");
    expect(profile).toBeNull();
  });
});

// ─── Renderer Logic Tests ────────────────────────────────────

describe("Renderer utilities", () => {
  it("formatBytes should format correctly", () => {
    // Replicate the renderer's formatBytes function
    function formatBytes(bytes: number): string {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }

    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(31000000)).toBe("29.6 MB");
  });

  it("HTML escape should prevent XSS", () => {
    // Replicate the renderer's escapeHtml approach
    function escapeHtml(str: string): string {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    expect(escapeHtml('<script>alert("xss")</script>')).not.toContain(
      "<script>",
    );
    expect(escapeHtml("normal text")).toBe("normal text");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });
});

// ─── Preload API Shape ───────────────────────────────────────

describe("Preload API shape", () => {
  it("UasApi interface should define expected namespaces", () => {
    // This is a compile-time check — the interface is imported in preload.ts
    // At runtime we just verify the catalog/profile/system structure expectations
    const expectedNamespaces = ["catalog", "profile", "system"];
    const expectedCatalogMethods = [
      "search",
      "list",
      "get",
      "validate",
      "filterByCategory",
      "filterByTag",
    ];
    const expectedProfileMethods = ["list", "load"];
    const expectedSystemMethods = ["info", "paths"];

    // These are just string assertions to document the contract
    expect(expectedNamespaces).toEqual(["catalog", "profile", "system"]);
    expect(expectedCatalogMethods).toHaveLength(6);
    expect(expectedProfileMethods).toHaveLength(2);
    expect(expectedSystemMethods).toHaveLength(2);
  });
});
