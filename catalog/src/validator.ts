/**
 * UAS Catalog — Recipe Validator
 *
 * Validates install recipes against the JSON Schema defined in schema.json.
 * Uses AJV for high-performance JSON Schema validation.
 *
 * Two levels of validation:
 * 1. Schema validation (structure, types, patterns) via AJV
 * 2. Semantic validation (business rules from the spec) via custom checks
 */

import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

/** A validation result */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  rule: string;
}

// Load the JSON Schema
const SCHEMA_PATH = path.join(__dirname, '..', 'schema.json');

let _validate: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (_validate) return _validate;

  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const schema = JSON.parse(schemaContent);

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  _validate = ajv.compile(schema);
  return _validate;
}

/**
 * Validate a recipe object against the JSON Schema + semantic rules.
 */
export function validateRecipe(recipe: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. JSON Schema validation
  const validate = getValidator();
  const schemaValid = validate(recipe);

  if (!schemaValid && validate.errors) {
    for (const err of validate.errors) {
      errors.push({
        path: err.instancePath || '/',
        message: err.message || 'Unknown validation error',
        rule: `schema:${err.keyword}`,
      });
    }
  }

  // 2. Semantic validation (business rules from the spec)
  errors.push(...validateSemanticRules(recipe));

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Semantic validation rules from the recipe spec.
 * These go beyond what JSON Schema can express.
 */
function validateSemanticRules(recipe: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Rule 6: Registry side effects require admin
  const sideEffects = recipe.side_effects as Record<string, unknown> | undefined;
  const requirements = recipe.requirements as Record<string, unknown> | undefined;

  if (sideEffects?.registry && Array.isArray(sideEffects.registry) && sideEffects.registry.length > 0) {
    if (!requirements?.admin) {
      errors.push({
        path: '/side_effects/registry',
        message: 'Registry side effects require requirements.admin to be true',
        rule: 'semantic:registry-requires-admin',
      });
    }
  }

  // Rule 7: PATH entries should use variables, not hardcoded paths
  const pathEffect = sideEffects?.path as Record<string, unknown> | undefined;
  if (pathEffect?.add && Array.isArray(pathEffect.add)) {
    for (const entry of pathEffect.add) {
      if (typeof entry === 'string' && /^[A-Z]:\\/.test(entry)) {
        errors.push({
          path: '/side_effects/path/add',
          message: `PATH entry "${entry}" uses a hardcoded absolute path. Use variables like \${PROGRAMFILES}.`,
          rule: 'semantic:path-use-variables',
        });
      }
    }
  }

  // Rule 9: No shell commands or script blocks
  const installer = recipe.installer as Record<string, unknown> | undefined;
  if (installer) {
    for (const key of ['pre_install', 'post_install', 'script', 'command', 'shell']) {
      if (key in installer) {
        errors.push({
          path: `/installer/${key}`,
          message: 'Recipes cannot contain shell commands or scripts',
          rule: 'semantic:no-shell-commands',
        });
      }
    }
  }

  // Verify installer type matches type-specific options
  if (installer?.type === 'exe' && !installer.exe) {
    errors.push({
      path: '/installer',
      message: 'Installer type "exe" requires an "exe" options block',
      rule: 'semantic:type-options-match',
    });
  }
  if (installer?.type === 'msi' && !installer.msi) {
    errors.push({
      path: '/installer',
      message: 'Installer type "msi" requires an "msi" options block',
      rule: 'semantic:type-options-match',
    });
  }
  if (installer?.type === 'zip' && !installer.zip) {
    errors.push({
      path: '/installer',
      message: 'Installer type "zip" requires a "zip" options block',
      rule: 'semantic:type-options-match',
    });
  }
  if (installer?.type === 'portable' && !installer.portable) {
    errors.push({
      path: '/installer',
      message: 'Installer type "portable" requires a "portable" options block',
      rule: 'semantic:type-options-match',
    });
  }

  return errors;
}
