import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src');
const sharedSource = path.join(root, 'shared');
const target = process.env.NIMO_PORTFOLIO_TARGET
  ? path.resolve(process.env.NIMO_PORTFOLIO_TARGET)
  : path.resolve(root, '..', 'portfolio', 'frontend', 'js', 'nimo-core');

if (!fs.existsSync(source)) throw new Error(`NIMO source not found: ${source}`);
const expectedSuffix = path.join('frontend', 'js', 'nimo-core');
if (!target.endsWith(expectedSuffix)) throw new Error(`Refusing to sync outside a frontend/js/nimo-core directory: ${target}`);
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, { recursive: true });
fs.writeFileSync(path.join(target, 'GENERATED.md'), '# Generated NIMO core\n\nThis directory is generated from the local NIMO-CORE `src/` package by `npm run sync:portfolio`. Do not edit it directly.\n');
const frontendRoot = path.resolve(target, '..', '..');
const sharedTarget = path.join(frontendRoot, 'js', 'shared');
fs.rmSync(sharedTarget, { recursive: true, force: true });
fs.cpSync(sharedSource, sharedTarget, { recursive: true });
fs.copyFileSync(path.join(sharedSource, 'adaptive', 'adaptive-ui.css'), path.join(frontendRoot, 'css', 'adaptive-ui.css'));
console.log(`Synced NIMO-CORE browser modules to ${target}`);
console.log(`Synced shared Fabric and adaptive engines to ${sharedTarget}`);
