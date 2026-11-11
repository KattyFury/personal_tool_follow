import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const folder = new URL('../extension/', import.meta.url);
for (const name of await readdir(folder)) if (name.endsWith('.js')) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(name, folder))], { encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr || result.error);
}
const manifest = JSON.parse(await readFile(new URL('manifest.json', folder), 'utf8'));
if (manifest.manifest_version !== 3) throw Error('Manifest V3 required');
console.log('Extension JavaScript syntax and manifest passed.');
