import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetDirs = ['src', 'shared', 'tests', 'scripts', 'examples'];

function collectFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      results.push(full);
    }
  }
  return results;
}

const allFiles = [];
for (const dir of targetDirs) {
  const p = path.join(root, dir);
  if (fs.existsSync(p)) allFiles.push(...collectFiles(p));
}

let errorCount = 0;
console.log(`Checking syntax across ${allFiles.length} JavaScript files...`);

for (const file of allFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    console.error(`Syntax error in ${path.relative(root, file)}:\n`, err.stderr?.toString() || err.message);
    errorCount++;
  }
}

if (errorCount > 0) {
  console.error(`\nFound ${errorCount} syntax error(s).`);
  process.exit(1);
}

console.log(`All ${allFiles.length} files passed syntax validation cleanly!`);
