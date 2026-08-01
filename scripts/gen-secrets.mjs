/**
 * Generates cryptographically strong secrets for the WebAR Menu project.
 * Usage: node scripts/gen-secrets.mjs
 *
 * NOTE: Supabase API keys (anon / service_role) CANNOT be generated here —
 * they must be rotated from the Supabase Dashboard (Settings → API → Rotate).
 */
import crypto from 'node:crypto';

const out = {
  JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
  ADMIN_API_KEY: crypto.randomBytes(32).toString('base64url'),
};

for (const [k, v] of Object.entries(out)) {
  console.log(`${k}=${v}`);
}
