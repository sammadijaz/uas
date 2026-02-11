/**
 * UAS Catalog — Catalog Loader
 *
 * Manages the catalog of install recipes stored on disk.
 * Provides loading, searching, indexing, and listing operations.
 *
 * Catalog structure:
 *   <catalog_dir>/
 *     recipes/
 *       <app-id>/
 *         recipe.yaml
 *     profiles/
 *       <profile-id>.yaml
 *     schema.json
 *
 * The loader builds an in-memory index on first access
 * and provides fast lookup by ID, search by text, and filtering.
 */

import * as fs from "fs";
import * as path from "path";
import { parse as parseYaml } from "yaml";
import { validateRecipe, ValidationResult } from "./validator";

/** Lightweight recipe reference for the index */
export interface CatalogEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  categories: string[];
  tags: string[];
  /** Path to the recipe YAML file */
  filePath: string;
}

/** Full recipe data (parsed from YAML) */
export type Recipe = Record<string, unknown>;

export class Catalog {
  private catalogDir: string;
  private entries: CatalogEntry[] | null = null;

  constructor(catalogDir: string) {
    this.catalogDir = catalogDir;
  }

  /**
   * Get the recipes directory path.
   */
  get recipesDir(): string {
    return path.join(this.catalogDir, "recipes");
  }

  /**
   * Get the profiles directory path.
   */
  get profilesDir(): string {
    return path.join(this.catalogDir, "profiles");
  }

  /**
   * Build the catalog index. Scans recipes directory for YAML files.
   * Caches the result — call refresh() to rebuild.
   */
  getEntries(): CatalogEntry[] {
    if (this.entries) return this.entries;
    this.entries = this.buildIndex();
    return this.entries;
  }

  /**
   * Force-rebuild the index.
   */
  refresh(): CatalogEntry[] {
    this.entries = null;
    return this.getEntries();
  }

  /**
   * Load a full recipe by app ID.
   */
  loadRecipe(appId: string): Recipe | null {
    const filePath = path.join(this.recipesDir, appId, "recipe.yaml");
    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return parseYaml(content) as Recipe;
    } catch {
      return null;
    }
  }

  /**
   * Validate a recipe by app ID.
   */
  validateRecipe(appId: string): ValidationResult | null {
    const recipe = this.loadRecipe(appId);
    if (!recipe) return null;
    return validateRecipe(recipe);
  }

  /**
   * Validate all recipes in the catalog.
   */
  validateAll(): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();
    const entries = this.getEntries();

    for (const entry of entries) {
      const recipe = this.loadRecipe(entry.id);
      if (recipe) {
        results.set(entry.id, validateRecipe(recipe));
      }
    }

    return results;
  }

  /**
   * Search recipes by query. Matches against id, name, description, tags, categories.
   */
  search(query: string): CatalogEntry[] {
    const q = query.toLowerCase();
    return this.getEntries().filter((entry) => {
      const haystack = [
        entry.id,
        entry.name,
        entry.description,
        ...entry.tags,
        ...entry.categories,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  /**
   * Filter recipes by category.
   */
  filterByCategory(category: string): CatalogEntry[] {
    const c = category.toLowerCase();
    return this.getEntries().filter((entry) =>
      entry.categories.some((cat) => cat.toLowerCase() === c),
    );
  }

  /**
   * Filter recipes by tag.
   */
  filterByTag(tag: string): CatalogEntry[] {
    const t = tag.toLowerCase();
    return this.getEntries().filter((entry) =>
      entry.tags.some((entryTag) => entryTag.toLowerCase() === t),
    );
  }

  /**
   * Get a specific entry by ID.
   */
  getEntry(appId: string): CatalogEntry | undefined {
    return this.getEntries().find((e) => e.id === appId);
  }

  /**
   * Check if a recipe exists in the catalog.
   */
  has(appId: string): boolean {
    return this.getEntry(appId) !== undefined;
  }

  /**
   * Get the number of recipes in the catalog.
   */
  get size(): number {
    return this.getEntries().length;
  }

  /**
   * List all available profile files.
   */
  listProfiles(): string[] {
    if (!fs.existsSync(this.profilesDir)) return [];
    return fs
      .readdirSync(this.profilesDir)
      .filter((f: string) => f.endsWith(".yaml"))
      .map((f: string) => f.replace(".yaml", ""));
  }

  /**
   * Load a profile by name.
   */
  loadProfile(name: string): Record<string, unknown> | null {
    let filePath = path.join(this.profilesDir, `${name}.yaml`);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(this.profilesDir, name);
    }
    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return parseYaml(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  // ─── Private ────────────────────────────────────────────────

  /**
   * Scan the recipes directory and build the index.
   */
  private buildIndex(): CatalogEntry[] {
    const entries: CatalogEntry[] = [];

    if (!fs.existsSync(this.recipesDir)) return entries;

    const dirs = fs
      .readdirSync(this.recipesDir, { withFileTypes: true })
      .filter((d: fs.Dirent) => d.isDirectory());

    for (const dir of dirs) {
      const recipeFile = path.join(this.recipesDir, dir.name, "recipe.yaml");
      if (!fs.existsSync(recipeFile)) continue;

      try {
        const content = fs.readFileSync(recipeFile, "utf-8");
        const recipe = parseYaml(content) as Record<string, unknown>;

        const metadata = recipe.metadata as Record<string, unknown> | undefined;

        entries.push({
          id: (recipe.id as string) || dir.name,
          name: (recipe.name as string) || dir.name,
          version: (recipe.version as string) || "unknown",
          description: (recipe.description as string) || "",
          categories: (metadata?.categories as string[]) || [],
          tags: (metadata?.tags as string[]) || [],
          filePath: recipeFile,
        });
      } catch {
        // Skip malformed recipes during indexing
      }
    }

    return entries.sort((a, b) => a.id.localeCompare(b.id));
  }
}
