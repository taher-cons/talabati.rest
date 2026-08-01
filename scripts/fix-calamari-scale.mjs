/**
 * The calamari GLB was authored at 4.4 m wide. The JS-side auto-rescale in
 * /view/main.js (normalizeScale) computed the right factor (0.077) and set
 * <model-viewer scale="...">, but that only affects the in-browser canvas —
 * it does NOT change the raw .glb bytes, so:
 *   1. model-viewer's own camera framing (camera-orbit percentage) is
 *      calibrated against the model's ORIGINAL 4.4 m bounding sphere, not
 *      the shrunk one, so after our JS shrinks it the camera is still
 *      "standing back" at a distance meant for a giant object — the dish
 *      renders as a tiny dot in the plain preview.
 *   2. AR hand-off (Scene Viewer / Quick Look) loads the raw .glb URL
 *      directly and does not know about a scale attribute we only set on
 *      the <model-viewer> DOM element in JS.
 *
 * The robust fix (same approach already used for the pilot pizza) is to
 * bake the correct scale into the GLB file itself with fix-glb-model.mjs,
 * then point the dish at that corrected file with scale reset to 1×1×1 so
 * nothing double-scales it.
 *
 * Run: node scripts/fix-calamari-scale.mjs
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('c:/web-ar-menu/.env', 'utf8').split(/\r?\n/).reduce((a, l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) a[m[1]] = m[2].replace(/^["']|["']$/g, '');
  return a;
}, {});

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CALAMARI_DISH_ID = 'caaecd76-875a-4298-b91d-1722f6b6ffbb';

const { data: calamari, error: getErr } = await db
  .from('dishes')
  .select('model3d')
  .eq('id', CALAMARI_DISH_ID)
  .single();
if (getErr) throw getErr;

const newModel = {
  ...calamari.model3d,
  url: '/firasse_resto/calamari_fixed.glb',
  scale: { x: 1, y: 1, z: 1 }, // baked into the file now — no JS multiplier needed
  rotation: { x: 0, y: 0, z: 0 },
};

const { error: updErr } = await db.from('dishes').update({ model3d: newModel }).eq('id', CALAMARI_DISH_ID);
if (updErr) throw updErr;

console.log('✔ calamari dish now points at calamari_fixed.glb (scale baked into the file, 0.32 m footprint)');
