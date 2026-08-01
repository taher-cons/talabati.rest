/**
 * push-secrets.mjs — uploads the secrets the Cloud Function declares into
 * Firebase Secret Manager, reading values from the local .env.
 *
 * Values are piped through stdin, never passed as CLI arguments (arguments are
 * visible in the process list / shell history).
 *
 * Usage: node scripts/push-secrets.mjs [--project <id>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const projIdx = args.indexOf('--project');
const PROJECT = projIdx !== -1 ? args[projIdx + 1] : 'talabati-946bb';

// Must stay in sync with the `secrets: [...]` array in functions/src/index.js
const SECRETS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_API_KEY',
];

const ROOT = path.resolve(import.meta.dirname, '..');
const envPath = path.join(ROOT, '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env not found. Run: node scripts/rotate-env.mjs');
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const isWin = process.platform === 'win32';
let failed = 0;

for (const name of SECRETS) {
  const value = env[name];
  if (!value) {
    console.error(`❌ ${name} missing from .env — skipped`);
    failed++;
    continue;
  }

  try {
    execFileSync(
      isWin ? 'firebase.cmd' : 'firebase',
      ['functions:secrets:set', name, '--project', PROJECT, '--force', '--data-file', '-'],
      { input: value, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], shell: isWin }
    );
    console.log(`✅ ${name} uploaded (${value.length} chars)`);
  } catch (err) {
    console.error(`❌ ${name} failed: ${(err.stderr || err.stdout || err.message).toString().trim().split('\n').slice(-3).join(' ')}`);
    failed++;
  }
}

console.log(
  failed === 0
    ? '\n🎉 All secrets stored in Secret Manager. Next: firebase deploy --only functions'
    : `\n⚠ ${failed} secret(s) failed. Fix, then re-run.`
);
process.exit(failed === 0 ? 0 : 1);
