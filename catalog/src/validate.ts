#!/usr/bin/env node

/**
 * UAS Catalog — CLI Validation Tool
 *
 * Validates all recipes in the catalog against the JSON Schema.
 * Run via: npm run validate
 *
 * Exit codes:
 *   0 - All recipes valid
 *   1 - One or more recipes invalid
 */

import * as path from 'path';
import { Catalog } from './loader';

const catalogDir = path.join(__dirname, '..');
const catalog = new Catalog(catalogDir);

console.log('UAS Catalog Validator');
console.log('====================\n');

const results = catalog.validateAll();
let hasErrors = false;

for (const [appId, result] of results) {
  if (result.valid) {
    console.log(`  ✔ ${appId}`);
  } else {
    hasErrors = true;
    console.log(`  ✖ ${appId}`);
    for (const error of result.errors) {
      console.log(`    - [${error.rule}] ${error.path}: ${error.message}`);
    }
  }
}

console.log(`\n${results.size} recipe(s) checked.`);

if (hasErrors) {
  console.log('Some recipes have validation errors.\n');
  process.exit(1);
} else {
  console.log('All recipes are valid.\n');
  process.exit(0);
}
