/**
 * Carga SNYK_TOKEN desde .env y lanza Snyk CLI. El token no se imprime.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
loadDotEnv(resolve(root, '.env'));

const token = String(process.env.SNYK_TOKEN || '').trim();
if (!token) {
  console.error('Falta SNYK_TOKEN en .env. No se imprime el valor.');
  process.exit(1);
}
process.env.SNYK_TOKEN = token;

const extra = process.argv.slice(2);
const args = extra.length
  ? extra
  : ['test', '--severity-threshold=high', '--policy-path=.snyk'];

const ran = spawnSync('npx', ['--yes', 'snyk', ...args], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});
process.exit(ran.status || 0);

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    if (!key || process.env[key]) continue;
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
