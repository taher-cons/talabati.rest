/**
 * rotate-env.mjs — rebuilds .env with freshly generated app secrets and the
 * project's NEW-STYLE Supabase API keys (sb_publishable_… / sb_secret_…),
 * fetched via the authenticated Supabase CLI.
 *
 * Nothing secret is printed to stdout — only masked confirmations.
 *
 * Usage: node scripts/rotate-env.mjs [--project-ref <ref>] [--keep-app-secrets]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const refIdx = args.indexOf('--project-ref');
const PROJECT_REF = refIdx !== -1 ? args[refIdx + 1] : 'hgyhkeuylgqrdtptahru';
const KEEP_APP_SECRETS = args.includes('--keep-app-secrets');

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');

const mask = (v) => (v ? `${v.slice(0, 12)}…${v.slice(-4)} (${v.length} chars)` : '(empty)');

function readExistingEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(ENV_PATH, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

function fetchApiKeys() {
  const isWin = process.platform === 'win32';
  const raw = execFileSync(
    isWin ? 'supabase.cmd' : 'supabase',
    ['projects', 'api-keys', '--project-ref', PROJECT_REF, '--reveal', '--output', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], shell: isWin }
  );
  const json = JSON.parse(raw.slice(raw.indexOf('[')));
  // Select by key `type` (legacy | publishable | secret) — never by position.
  const publishable = json.find((k) => k.type === 'publishable');
  const secret = json.find((k) => k.type === 'secret');
  if (!publishable?.api_key || !secret?.api_key) {
    throw new Error(
      'Could not find publishable/secret API keys. Create them in Supabase Dashboard → Settings → API Keys.'
    );
  }
  if (!secret.api_key.startsWith('sb_secret_')) {
    throw new Error('Secret key looks masked — is the CLI logged in with --reveal permission?');
  }
  return { publishable: publishable.api_key, secret: secret.api_key };

}

const prev = readExistingEnv();
const { publishable, secret } = fetchApiKeys();

const appSecrets = {
  JWT_SECRET:
    KEEP_APP_SECRETS && prev.JWT_SECRET ? prev.JWT_SECRET : crypto.randomBytes(32).toString('hex'),
  SESSION_SECRET:
    KEEP_APP_SECRETS && prev.SESSION_SECRET
      ? prev.SESSION_SECRET
      : crypto.randomBytes(32).toString('hex'),
  ADMIN_API_KEY:
    KEEP_APP_SECRETS && prev.ADMIN_API_KEY
      ? prev.ADMIN_API_KEY
      : crypto.randomBytes(32).toString('base64url'),
};

const env = `# ============================================================
# WebAR Menu (طلباتي) — LOCAL ENVIRONMENT
# ⚠ NEVER COMMIT THIS FILE. It is listed in .gitignore.
# Regenerate with: node scripts/rotate-env.mjs
# Generated: ${new Date().toISOString()}
# ============================================================

# --- Server ---
NODE_ENV=production
PORT=3000

# --- Supabase ---
SUPABASE_URL=https://${PROJECT_REF}.supabase.co

# New-style API keys. The legacy anon/service_role JWT keys were leaked in
# .env / .env.production / .env.txt and MUST stay disabled in the Dashboard
# (Settings → API Keys → Legacy JWT keys → Disable).
SUPABASE_ANON_KEY=${publishable}
SUPABASE_SERVICE_ROLE_KEY=${secret}

# Explicit aliases (same values, clearer names)
SUPABASE_PUBLISHABLE_KEY=${publishable}
SUPABASE_SECRET_KEY=${secret}

# --- Client / CORS ---
CLIENT_URL=https://talabati.rest
ALLOWED_ORIGINS=https://talabati.rest,https://www.talabati.rest,https://talabati-946bb.web.app,https://talabati-946bb.firebaseapp.com

# --- Admin API protection (x-admin-key header for /api/*/admin/** + uploads) ---
ADMIN_API_KEY=${appSecrets.ADMIN_API_KEY}

# --- App secrets ---
JWT_SECRET=${appSecrets.JWT_SECRET}
SESSION_SECRET=${appSecrets.SESSION_SECRET}

# --- File upload ---
UPLOAD_MAX_SIZE=52428800
UPLOAD_PATH=./public/uploads

# --- CDN ---
CDN_BASE_URL=https://talabati.rest

# --- Email (optional) ---
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

# --- Monitoring (optional) ---
GA_MEASUREMENT_ID=
SENTRY_DSN=
`;

fs.writeFileSync(ENV_PATH, env, 'utf8');

console.log('✅ .env rewritten with rotated credentials');
console.log(`   SUPABASE_ANON_KEY        = ${mask(publishable)}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY= ${mask(secret)}`);
console.log(`   ADMIN_API_KEY            = ${mask(appSecrets.ADMIN_API_KEY)}`);
console.log(`   JWT_SECRET               = ${mask(appSecrets.JWT_SECRET)}`);
console.log(`   SESSION_SECRET           = ${mask(appSecrets.SESSION_SECRET)}`);
console.log('\nNext: node scripts/push-secrets.mjs   (upload to Firebase Secret Manager)');
