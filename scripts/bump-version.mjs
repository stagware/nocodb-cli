#!/usr/bin/env node

/**
 * Bumps the version across all package.json files and the CLI version string.
 *
 * Usage:
 *   node scripts/bump-version.mjs <new-version>
 *   node scripts/bump-version.mjs 0.2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Usage: node scripts/bump-version.mjs <new-version>');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(newVersion)) {
  console.error(`Invalid semver: ${newVersion}`);
  process.exit(1);
}

// --- 1. Update package.json files ---

const packagePaths = [
  'package.json',
  'packages/sdk/package.json',
  'packages/cli/package.json',
];

for (const rel of packagePaths) {
  const filePath = path.join(root, rel);
  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const oldVersion = pkg.version;
  pkg.version = newVersion;

  // Update workspace dependency versions (e.g. @stagware/nocodb-sdk in CLI)
  for (const depField of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (!pkg[depField]) continue;
    for (const [name, ver] of Object.entries(pkg[depField])) {
      if (name.startsWith('@stagware/') && typeof ver === 'string') {
        pkg[depField][name] = `^${newVersion}`;
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`  ${rel}: ${oldVersion} -> ${newVersion}`);
}

// --- 2. Update .version() in CLI index.ts ---

const indexPath = path.join(root, 'packages/cli/src/index.ts');
let indexSrc = fs.readFileSync(indexPath, 'utf8');

const versionRe = /\.version\(["']\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?["']\)/;
const match = indexSrc.match(versionRe);
if (match) {
  const replacement = `.version("${newVersion}")`;
  indexSrc = indexSrc.replace(versionRe, replacement);
  fs.writeFileSync(indexPath, indexSrc, 'utf8');
  console.log(`  packages/cli/src/index.ts: ${match[0]} -> ${replacement}`);
} else {
  console.warn('  ⚠ Could not find .version() call in index.ts — update manually');
}

console.log(`\nVersion bumped to ${newVersion}`);
