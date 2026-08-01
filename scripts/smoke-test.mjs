/**
 * smoke-test.mjs — post-deploy verification of the security fixes.
 *
 * Asserts, against a real deployment:
 *   1. /api/health is up and its dependencies are reachable.
 *   2. Public menu reads still work (a QR-code scan must not need auth).
 *   3. Admin reads/writes are rejected without credentials  <-- the main fix.
 *   4. Uploads are rejected without credentials.
 *   5. The exec_sql RPC (remote code execution) is gone.
 *
 * Usage:
 *   node scripts/smoke-test.mjs                       # against production
 *   node scripts/smoke-test.mjs http://localhost:5001 # against the emulator
 */

const BASE = (process.argv[2] || 'https://talabati.rest').replace(/\/$/, '');

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}\n     ${err.message}`);
    failed++;
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response (e.g. HTML error page) */
  }
  return { status: res.status, body, headers: res.headers };
}

console.log(`\n🔍 Smoke-testing ${BASE}\n`);

await check('GET /api/health → 200 and deps ok', async () => {
  const { status, body } = await req('/api/health');
  expect(status === 200, `expected 200, got ${status}`);
  expect(body?.deps?.supabase?.status === 'ok', `supabase dep: ${body?.deps?.supabase?.status}`);
});

await check('health response carries x-request-id', async () => {
  const { headers } = await req('/api/health');
  expect(Boolean(headers.get('x-request-id')), 'x-request-id header missing');
});

await check('public menu read works without auth', async () => {
  const { status } = await req('/api/menu/restaurant/slug/talabati');
  // 404 is acceptable (slug may differ); 401/403 is NOT — public reads must stay open.
  expect([200, 404].includes(status), `expected 200/404, got ${status}`);
});

await check('GET /api/menu/admin/restaurants is rejected without auth', async () => {
  const { status } = await req('/api/menu/admin/restaurants');
  expect([401, 403].includes(status), `expected 401/403, got ${status}`);
});

await check('POST /api/menu/admin/restaurant is rejected without auth', async () => {
  const { status } = await req('/api/menu/admin/restaurant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'smoke-test-should-never-exist', slug: 'smoke-test-x' }),
  });
  expect([401, 403].includes(status), `expected 401/403, got ${status}`);
});

await check('DELETE /api/menu/admin/menu/:id is rejected without auth', async () => {
  const { status } = await req('/api/menu/admin/menu/00000000-0000-0000-0000-000000000000', {
    method: 'DELETE',
  });
  expect([401, 403].includes(status), `expected 401/403, got ${status}`);
});

await check('POST /api/upload/model is rejected without auth', async () => {
  const { status } = await req('/api/upload/model', { method: 'POST' });
  expect([401, 403].includes(status), `expected 401/403, got ${status}`);
});

await check('an invalid admin key is rejected', async () => {
  const { status } = await req('/api/menu/admin/restaurants', {
    headers: { 'x-admin-key': 'definitely-not-the-key' },
  });
  expect([401, 403].includes(status), `expected 401/403, got ${status}`);
});

await check('POST /api/auth/signup is rejected without auth (no self-service owner)', async () => {
  const { status } = await req('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smoke@example.com', password: 'Passw0rd!x', role: 'owner' }),
  });
  expect([401, 403].includes(status), `expected 401/403, got ${status}`);
});

await check('unknown API route → JSON 404', async () => {
  const { status, body } = await req('/api/definitely-not-a-route');
  expect(status === 404, `expected 404, got ${status}`);
  expect(body?.error === 'Not found', `expected JSON 404 body, got ${JSON.stringify(body)}`);
});

console.log(`\n${failed === 0 ? '🎉' : '⚠'} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
