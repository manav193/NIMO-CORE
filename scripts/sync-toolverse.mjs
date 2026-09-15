import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.env.NIMO_TOOLVERSE_TARGET
  ? path.resolve(process.env.NIMO_TOOLVERSE_TARGET)
  : path.resolve(root, '..', 'tool verse', 'js', 'nimo-core');
const expectedSuffix = path.join('js', 'nimo-core');
if (!target.endsWith(expectedSuffix)) throw new Error(`Refusing to sync outside a js/nimo-core directory: ${target}`);

const files = [
  ['src/federation/project-events.js', 'federation/project-events.js'],
  ['src/utils/validation.js', 'utils/validation.js']
];
fs.rmSync(target, { recursive: true, force: true });
for (const [sourceRelative, targetRelative] of files) {
  const destination = path.join(target, targetRelative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, sourceRelative), destination);
}
fs.writeFileSync(path.join(target, 'GENERATED.md'), '# Generated NIMO event contract\n\nGenerated from NIMO-CORE by `npm run sync:toolverse`. ToolVerse visuals and action execution remain host-owned.\n');
const projectRoot = path.resolve(target, '..', '..');
const sharedTarget = path.join(projectRoot, 'js', 'shared');
const sharedSource = path.join(root, 'shared');
fs.rmSync(sharedTarget, { recursive: true, force: true });
fs.cpSync(sharedSource, sharedTarget, { recursive: true });
fs.copyFileSync(path.join(sharedSource, 'adaptive', 'adaptive-ui.css'), path.join(projectRoot, 'css', 'adaptive-ui.css'));
console.log(`Synced NIMO event contract to ${target}`);
console.log(`Synced shared Fabric and adaptive engines to ${sharedTarget}`);
