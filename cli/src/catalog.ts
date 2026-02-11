/**
 * UAS CLI — Catalog Loader
 *
 * Loads install recipes from the local catalog directory.
 * The catalog is a folder of YAML files, each defining one recipe.
 *
 * Structure:
 *   ~/.uas/catalog/
 *     node.yaml
 *     python.yaml
 *     git.yaml
 *     ...
 *
 * This module provides lookup by ID, search, and listing.
 * In Phase 4, the catalog system will replace this with a richer
 * versioned index — but this serves as the CLI's bridge until then.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { InstallRecipe } from '@uas/engine';
import { paths } from './config';

/**
 * Load a single recipe by ID from the catalog directory.
 * Looks for <catalog_dir>/<id>.yaml
 */
export function loadRecipe(appId: string): InstallRecipe | null {
  const filePath = path.join(paths.catalog, `${appId}.yaml`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  return parseYaml(content) as InstallRecipe;
}

/**
 * List all available recipes in the catalog.
 */
export function listRecipes(): InstallRecipe[] {
  if (!fs.existsSync(paths.catalog)) return [];

  const files = fs.readdirSync(paths.catalog).filter((f) => f.endsWith('.yaml'));
  const recipes: InstallRecipe[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(paths.catalog, file), 'utf-8');
      recipes.push(parseYaml(content) as InstallRecipe);
    } catch {
      // Skip malformed recipes
    }
  }

  return recipes;
}

/**
 * Search recipes by query string. Matches against id, name, description, tags.
 */
export function searchRecipes(query: string): InstallRecipe[] {
  const q = query.toLowerCase();
  return listRecipes().filter((r) => {
    const haystack = [
      r.id,
      r.name,
      r.description,
      ...(r.metadata?.tags || []),
      ...(r.metadata?.categories || []),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
