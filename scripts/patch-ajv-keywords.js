/**
 * Patch ajv-keywords@3.x to guard against ajv@8.x (_formats is undefined).
 * This fixes the "Cannot read properties of undefined (reading 'date')" crash
 * in _formatLimit.js:63 when running with Node.js v22+.
 *
 * Root cause: Yarn 4 hoists ajv@8.x to top-level, but ajv-keywords@3.x
 * (used by fork-ts-checker-webpack-plugin via schema-utils@2.7.0) expects ajv@6.x.
 */

const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'ajv-keywords',
  'keywords',
  '_formatLimit.js'
);

if (!fs.existsSync(target)) {
  console.log('[patch-ajv-keywords] File not found, skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(target, 'utf8');

const GUARD = 'if (!formats) return; // patched: guard against ajv@8.x';

if (content.includes(GUARD)) {
  console.log('[patch-ajv-keywords] Already patched, skipping.');
  process.exit(0);
}

const BEFORE = 'function extendFormats(ajv) {\n  var formats = ajv._formats;\n  for';
const AFTER  = 'function extendFormats(ajv) {\n  var formats = ajv._formats;\n  ' + GUARD + '\n  for';

if (!content.includes(BEFORE)) {
  console.warn('[patch-ajv-keywords] Could not find the target code — patch skipped.');
  process.exit(0);
}

fs.writeFileSync(target, content.replace(BEFORE, AFTER), 'utf8');
console.log('[patch-ajv-keywords] Patched successfully.');
