/**
 * End-to-end check of the customer's 3D path against the LIVE site:
 *   /view page  →  dish API  →  the GLB file itself
 *
 * Run: node scripts/verify-view.mjs [https://talabati.rest] [slug]
 * Exits non-zero if any step the customer depends on is broken.
 */
const BASE = process.argv[2] || 'https://talabati.rest';
const SLUG = process.argv[3] || 'firasse_food';

let failures = 0;
const ok = (msg) => console.log(`  PASS  ${msg}`);
const bad = (msg) => { failures += 1; console.log(`  FAIL  ${msg}`); };

async function main() {
  console.log(`\nTarget: ${BASE}\n`);

  // 1. the viewer page must be served (rewrite works)
  const page = await fetch(`${BASE}/view?dish=test`);
  const html = await page.text();
  page.ok ? ok(`/view returns ${page.status}`) : bad(`/view returns ${page.status}`);
  html.includes('model-viewer')
    ? ok('/view HTML contains <model-viewer>')
    : bad('/view HTML is not the viewer page (rewrite fell through to index.html?)');

  // 1b. the camera must be framed from above. The default 75° orbit looked
  // edge-on at the dish and showed only the pale underside of the dough.
  const cameraChecks = [
    ['camera-orbit="0deg 50deg 115%"', 'camera framed from above (50°)'],
    ['max-camera-orbit', 'orbit clamped so the customer cannot spin under the plate'],
    ['field-of-view="32deg"', 'narrow field of view (no fish-eye distortion)']
  ];
  for (const [needle, label] of cameraChecks) {
    html.includes(needle) ? ok(label) : bad(`${label} — missing "${needle}"`);
  }

  const viewerJs = await (await fetch(`${BASE}/view/main.js`)).text();
  viewerJs.includes('normalizeScale')
    ? ok('oversized models are rescaled to a realistic plate size before AR')
    : bad('scale normalisation missing — a 0.92 m pizza would be placed on the table');

  // 1c. the featured carousel must rely on native scrolling only. A manual
  // translateX on a scroll container clipped the section and left it blank.
  const menuJs = await (await fetch(`${BASE}/menu/main.js`)).text();
  // Match a real assignment, not the word "translateX" inside an explanatory
  // comment — the first version of this check failed on its own documentation.
  /transform\s*=\s*[`'"]translateX/.test(menuJs)
    ? bad('menu/main.js still moves the carousel with translateX (fights native scroll)')
    : ok('carousel uses native scrolling (no translateX transform)');
  menuJs.includes('scrollByCards')
    ? ok('carousel arrows scroll by one real card width')
    : bad('carousel navigation helper missing');

  // 2. restaurant → menu
  const restaurantRes = await fetch(`${BASE}/api/menu/restaurant/slug/${SLUG}`);
  if (!restaurantRes.ok) {
    bad(`restaurant lookup ${restaurantRes.status}`);
    return;
  }
  const restaurant = await restaurantRes.json();
  ok(`restaurant "${restaurant.name}" resolved`);

  const menuRes = await fetch(`${BASE}/api/menu/restaurant/${restaurant._id || restaurant.id}`);
  const menu = await menuRes.json();
  const dishes = menu.dishes || [];
  console.log(`\n  ${dishes.length} dishes in the menu`);

  const withModel = dishes.filter((d) => d.model3D?.url);
  withModel.length
    ? ok(`${withModel.length} dish(es) have a 3D model`)
    : bad('no dish has model3D.url — the 3D button has nothing to show');

  // 3. every advertised model must actually download, and be a real GLB
  for (const dish of withModel) {
    const label = dish.nameAr || dish.name;

    const detail = await fetch(`${BASE}/api/menu/dish/${dish._id}`);
    const payload = detail.ok ? await detail.json() : {};
    const url = (payload.dish || payload)?.model3D?.url;
    url
      ? ok(`dish API returns a model URL for "${label}"`)
      : bad(`dish API returns NO model URL for "${label}" (the viewer would show an error)`);
    if (!url) continue;

    const absolute = url.startsWith('http') ? url : `${BASE}${url}`;
    const asset = await fetch(absolute);
    const buffer = Buffer.from(await asset.arrayBuffer());
    const magic = buffer.subarray(0, 4).toString('ascii'); // valid GLB starts with "glTF"
    const kb = Math.round(buffer.length / 1024);

    if (!asset.ok) {
      bad(`model for "${label}" → HTTP ${asset.status} (${absolute})`);
    } else if (magic !== 'glTF') {
      bad(`model for "${label}" is not a GLB (magic "${magic}") — ${absolute}`);
    } else {
      ok(`model for "${label}" downloads: ${kb} KB, ${asset.headers.get('content-type')}`);
      // Phones on 3G/4G in a restaurant: anything past ~5 MB feels broken.
      if (kb > 5120) console.log(`        NOTE ${kb} KB is heavy for a phone on mobile data`);
    }
  }

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('verification crashed:', error);
  process.exit(1);
});
