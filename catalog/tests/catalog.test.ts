/**
 * UAS Catalog — Tests
 *
 * Tests for the validator, loader, and sample recipes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import { validateRecipe, ValidationResult, Catalog } from '../src';

const CATALOG_DIR = path.join(__dirname, '..');

// ─── Helper: Minimal Valid Recipe ────────────────────────────

function minimalExeRecipe(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'test-app',
    name: 'Test App',
    description: 'A test application',
    homepage: 'https://example.com',
    license: 'MIT',
    version: '1.0.0',
    installer: {
      type: 'exe',
      url: 'https://example.com/setup.exe',
      sha256: 'a'.repeat(64),
      exe: { silent_args: ['/S'] },
    },
    side_effects: {},
    metadata: {
      categories: ['development'],
      tags: ['test'],
      maintainer: 'tester',
      updated: '2026-01-01',
    },
    requirements: {
      os: '10.0.0',
      arch: 'x64',
      admin: false,
      dependencies: [],
    },
    ...overrides,
  };
}

function minimalMsiRecipe(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...minimalExeRecipe(),
    id: 'msi-app',
    installer: {
      type: 'msi',
      url: 'https://example.com/setup.msi',
      sha256: 'b'.repeat(64),
      msi: { properties: { INSTALLDIR: '${PROGRAMFILES}\\msiapp' } },
    },
    ...overrides,
  };
}

function minimalZipRecipe(): Record<string, unknown> {
  return {
    ...minimalExeRecipe(),
    id: 'zip-app',
    installer: {
      type: 'zip',
      url: 'https://example.com/app.zip',
      sha256: 'c'.repeat(64),
      zip: { extract_to: '${LOCALAPPDATA}\\zipapp' },
    },
  };
}

function minimalPortableRecipe(): Record<string, unknown> {
  return {
    ...minimalExeRecipe(),
    id: 'portable-app',
    installer: {
      type: 'portable',
      url: 'https://example.com/app.exe',
      sha256: 'd'.repeat(64),
      portable: { copy_to: '${LOCALAPPDATA}\\portableapp', executable: 'app.exe' },
    },
  };
}

// ─── Schema Validation Tests ─────────────────────────────────

describe('Schema Validation', () => {
  it('should accept a valid exe recipe', () => {
    const result = validateRecipe(minimalExeRecipe());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept a valid msi recipe', () => {
    const result = validateRecipe(minimalMsiRecipe());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept a valid zip recipe', () => {
    const result = validateRecipe(minimalZipRecipe());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept a valid portable recipe', () => {
    const result = validateRecipe(minimalPortableRecipe());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject a recipe with missing required fields', () => {
    const result = validateRecipe({ id: 'incomplete' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    const rules = result.errors.map((e) => e.rule);
    expect(rules.some((r) => r.includes('schema:'))).toBe(true);
  });

  it('should reject an invalid id format', () => {
    const recipe = minimalExeRecipe({ id: 'UPPERCASE_BAD' });
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === '/id')).toBe(true);
  });

  it('should reject HTTP (non-HTTPS) download URL', () => {
    const recipe = minimalExeRecipe({
      installer: {
        ...minimalExeRecipe().installer as Record<string, unknown>,
        url: 'http://example.com/setup.exe',
      },
    });
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('/installer'))).toBe(true);
  });

  it('should reject invalid sha256 hash', () => {
    const recipe = minimalExeRecipe({
      installer: {
        ...minimalExeRecipe().installer as Record<string, unknown>,
        sha256: 'tooshort',
      },
    });
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(false);
  });

  it('should reject exe type without exe options', () => {
    const recipe = minimalExeRecipe({
      installer: {
        type: 'exe',
        url: 'https://example.com/setup.exe',
        sha256: 'a'.repeat(64),
        // intentionally missing exe: { ... }
      },
    });
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(false);
  });

  it('should reject invalid architecture', () => {
    const recipe = minimalExeRecipe({
      requirements: {
        os: '10.0.0',
        arch: 'powerpc', // invalid
        admin: false,
        dependencies: [],
      },
    });
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(false);
  });
});

// ─── Semantic Validation Tests ───────────────────────────────

describe('Semantic Validation', () => {
  it('should flag registry side effects without admin', () => {
    const recipe = minimalExeRecipe({
      side_effects: {
        registry: [
          { key: 'HKLM\\SOFTWARE\\Test', value_name: 'Test', value_data: '1', value_type: 'REG_SZ' },
        ],
      },
      requirements: {
        os: '10.0.0',
        arch: 'x64',
        admin: false, // <-- should be true for registry
        dependencies: [],
      },
    });
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'semantic:registry-requires-admin')).toBe(true);
  });

  it('should accept registry side effects with admin', () => {
    const recipe = minimalExeRecipe({
      side_effects: {
        registry: [
          { key: 'HKLM\\SOFTWARE\\Test', value_name: 'Test', value_data: '1', value_type: 'REG_SZ' },
        ],
      },
      requirements: {
        os: '10.0.0',
        arch: 'x64',
        admin: true,
        dependencies: [],
      },
    });
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(true);
  });

  it('should flag hardcoded PATH entries', () => {
    const recipe = minimalExeRecipe({
      side_effects: {
        path: { add: ['C:\\Program Files\\TestApp'] },
      },
    });
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'semantic:path-use-variables')).toBe(true);
  });

  it('should accept PATH entries using variables', () => {
    const recipe = minimalExeRecipe({
      side_effects: {
        path: { add: ['${PROGRAMFILES}\\TestApp'] },
      },
    });
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(true);
  });

  it('should flag shell commands in installer', () => {
    const base = minimalExeRecipe();
    (base.installer as Record<string, unknown>).post_install = 'echo done';
    const result = validateRecipe(base);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'semantic:no-shell-commands')).toBe(true);
  });

  it('should flag mismatched installer type and options', () => {
    const recipe = minimalExeRecipe({
      installer: {
        type: 'msi',
        url: 'https://example.com/setup.msi',
        sha256: 'a'.repeat(64),
        // missing msi: { ... }
      },
    });
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(false);
    // Both schema and semantic should catch this
    expect(result.errors.some((e) =>
      e.rule === 'semantic:type-options-match' || e.rule.startsWith('schema:')
    )).toBe(true);
  });
});

// ─── Catalog Loader Tests ────────────────────────────────────

describe('Catalog Loader', () => {
  let catalog: Catalog;

  beforeEach(() => {
    catalog = new Catalog(CATALOG_DIR);
  });

  it('should discover all sample recipes', () => {
    const entries = catalog.getEntries();
    expect(entries.length).toBeGreaterThanOrEqual(5);

    const ids = entries.map((e) => e.id);
    expect(ids).toContain('node');
    expect(ids).toContain('git');
    expect(ids).toContain('python');
    expect(ids).toContain('vscode');
    expect(ids).toContain('rust');
  });

  it('should return sorted entries', () => {
    const entries = catalog.getEntries();
    const ids = entries.map((e) => e.id);
    const sortedIds = [...ids].sort();
    expect(ids).toEqual(sortedIds);
  });

  it('should cache entries on repeat calls', () => {
    const first = catalog.getEntries();
    const second = catalog.getEntries();
    expect(first).toBe(second); // Same array reference
  });

  it('should load a recipe by ID', () => {
    const recipe = catalog.loadRecipe('node');
    expect(recipe).not.toBeNull();
    expect(recipe!.id).toBe('node');
    expect(recipe!.name).toBe('Node.js');
    expect(recipe!.version).toBe('22.14.0');
  });

  it('should return null for unknown recipe', () => {
    expect(catalog.loadRecipe('nonexistent-app')).toBeNull();
  });

  it('should search by name', () => {
    const results = catalog.search('node');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.id === 'node')).toBe(true);
  });

  it('should search by tag', () => {
    const results = catalog.search('npm');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.id === 'node')).toBe(true);
  });

  it('should search case-insensitively', () => {
    const results = catalog.search('NODE');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter by category', () => {
    const devTools = catalog.filterByCategory('development');
    expect(devTools.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter by tag', () => {
    const results = catalog.filterByTag('rust');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.id === 'rust')).toBe(true);
  });

  it('should get entry by ID', () => {
    const entry = catalog.getEntry('git');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('Git');
  });

  it('should report correct size', () => {
    expect(catalog.size).toBeGreaterThanOrEqual(5);
  });

  it('should have has() method', () => {
    expect(catalog.has('node')).toBe(true);
    expect(catalog.has('nonexistent')).toBe(false);
  });

  it('should refresh the index', () => {
    const first = catalog.getEntries();
    const second = catalog.refresh();
    // Different array references but same content
    expect(first).not.toBe(second);
    expect(first.length).toBe(second.length);
  });
});

// ─── Profile Tests ───────────────────────────────────────────

describe('Profiles', () => {
  let catalog: Catalog;

  beforeEach(() => {
    catalog = new Catalog(CATALOG_DIR);
  });

  it('should list available profiles', () => {
    const profiles = catalog.listProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(1);
    expect(profiles).toContain('frontend-dev');
  });

  it('should load a profile by name', () => {
    const profile = catalog.loadProfile('frontend-dev');
    expect(profile).not.toBeNull();
    expect(profile!.name).toBe('Frontend Developer');
    expect(profile!.id).toBe('frontend-dev');
  });

  it('should return null for unknown profile', () => {
    expect(catalog.loadProfile('nonexistent-profile')).toBeNull();
  });

  it('should have apps in the profile', () => {
    const profile = catalog.loadProfile('frontend-dev');
    expect(profile).not.toBeNull();
    const apps = profile!.apps as Array<{ id: string; version: string; optional: boolean }>;
    expect(apps.length).toBeGreaterThanOrEqual(3);
    const ids = apps.map((a) => a.id);
    expect(ids).toContain('node');
    expect(ids).toContain('git');
    expect(ids).toContain('vscode');
  });
});

// ─── Sample Recipe Validation ────────────────────────────────

describe('Sample Recipe Validation', () => {
  let catalog: Catalog;

  beforeEach(() => {
    catalog = new Catalog(CATALOG_DIR);
  });

  it('should validate all sample recipes (schema only)', () => {
    const results = catalog.validateAll();
    expect(results.size).toBeGreaterThanOrEqual(5);

    for (const [id, result] of results) {
      // All should pass schema validation
      const schemaErrors = result.errors.filter((e) => e.rule.startsWith('schema:'));
      expect(schemaErrors, `Schema errors in ${id}: ${JSON.stringify(schemaErrors)}`).toHaveLength(0);
    }
  });

  it('should validate node recipe fully', () => {
    const result = catalog.validateRecipe('node');
    expect(result).not.toBeNull();
    expect(result!.valid).toBe(true);
  });

  it('should validate git recipe fully', () => {
    const result = catalog.validateRecipe('git');
    expect(result).not.toBeNull();
    expect(result!.valid).toBe(true);
  });

  it('should validate python recipe fully', () => {
    const result = catalog.validateRecipe('python');
    expect(result).not.toBeNull();
    expect(result!.valid).toBe(true);
  });

  it('should validate vscode recipe fully', () => {
    const result = catalog.validateRecipe('vscode');
    expect(result).not.toBeNull();
    expect(result!.valid).toBe(true);
  });

  it('should validate rust recipe fully', () => {
    const result = catalog.validateRecipe('rust');
    expect(result).not.toBeNull();
    expect(result!.valid).toBe(true);
  });
});
