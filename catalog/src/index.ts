/**
 * UAS Catalog — Public API
 *
 * Main entry point for the catalog package.
 * Exports the Catalog class, validator, and types.
 */

export { Catalog } from './loader';
export type { CatalogEntry, Recipe } from './loader';
export { validateRecipe } from './validator';
export type { ValidationResult, ValidationError } from './validator';
