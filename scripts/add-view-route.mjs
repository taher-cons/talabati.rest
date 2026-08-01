/**
 * Registers the /view route (3D dish viewer) in firebase.json:
 *   - rewrites, so /view?dish=... serves public/view/index.html
 *   - a page-specific CSP that allows model-viewer from jsDelivr
 *
 * Idempotent: safe to run more than once.
 * Run: node scripts/add-view-route.mjs
 */
import fs from 'node:fs';

const FILE = 'firebase.json';
const config = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const { rewrites, headers } = config.hosting;

// --- rewrites: must sit BEFORE the '**' catch-all that serves the landing page
if (!rewrites.some((r) => r.source === '/view')) {
  const catchAllIndex = rewrites.findIndex((r) => r.source === '**');
  const insertAt = catchAllIndex === -1 ? rewrites.length : catchAllIndex;
  rewrites.splice(
    insertAt,
    0,
    { source: '/view', destination: '/view/index.html' },
    { source: '/view/**', destination: '/view/index.html' }
  );
  console.log('+ rewrites for /view');
} else {
  console.log('= rewrites already present');
}

// --- headers: Firebase applies every matching block, later ones win, so this
//     must come after the generic '**' block to override its CSP.
const VIEW_SOURCE = '/view{,/**}';
if (!headers.some((h) => h.source === VIEW_SOURCE)) {
  headers.push({
    source: VIEW_SOURCE,
    headers: [
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          // model-viewer element
          "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
          "style-src 'self' 'unsafe-inline'",
          // dish photos are served from our own bucket/hosting; blob: is used
          // internally by model-viewer for textures
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          // GLB comes from 'self'; jsDelivr covers model-viewer's optional
          // DRACO/KTX2 transcoders
          "connect-src 'self' https://cdn.jsdelivr.net",
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join('; '),
      },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Native AR (Scene Viewer / WebXR) needs camera + spatial tracking.
      {
        key: 'Permissions-Policy',
        value: 'camera=(self), xr-spatial-tracking=(self), geolocation=(), microphone=()',
      },
    ],
  });
  console.log('+ headers for /view');
} else {
  console.log('= headers already present');
}

fs.writeFileSync(FILE, `${JSON.stringify(config, null, 2)}\n`);
console.log('\nrewrites:', rewrites.map((r) => r.source).join(' | '));
