/**
 * Pre-launch cleanup for the Firasse Food pilot menu, before sharing the link
 * with the restaurant owner:
 *
 *   1. Remove the "Image Test - Rubber Duck" dish — it was diagnostic-only
 *      and must not be visible on the live menu the owner sees.
 *   2. Fix the calamari dish: it pointed at c_1.glb, which is a thin, tall,
 *      narrow slab (X=0.956 Y=0.739 Z=0.215 — height nearly as large as
 *      width, virtually no depth). That is exactly the "standing upright
 *      like a thin vertical slab" bug the owner reported. Point it instead
 *      at the newly supplied grilled_stuffed_calamari_with_roasted_tomatoes_3d.glb,
 *      which is already authored lying flat (Y=0.12 height vs 4.4 footprint)
 *      — no rotation correction needed, just the correct file.
 *   3. Link a second real dish (Ultimate Cheese & Pepperoni Pizza) to the
 *      pizaa3d.glb model so the owner sees at least 3 real dishes with a
 *      working 3D model, not just one.
 *
 * Run: node scripts/finalize-pilot-menu.mjs
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('c:/web-ar-menu/.env', 'utf8').split(/\r?\n/).reduce((a, l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) a[m[1]] = m[2].replace(/^["']|["']$/g, '');
  return a;
}, {});

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const DUCK_TEST_DISH_ID = 'dff21722-3b7b-4e53-aa75-53c97cc40ebe';
const CALAMARI_DISH_ID = 'caaecd76-875a-4298-b91d-1722f6b6ffbb';
const ULTIMATE_PIZZA_ID = 'ac10a115-8e34-4c1f-bd78-1816ecf27cb9';

async function main() {
  // 1) Remove the test dish entirely.
  const { error: delError } = await db.from('dishes').delete().eq('id', DUCK_TEST_DISH_ID);
  if (delError) throw delError;
  console.log('✔ deleted test dish (rubber duck) from live menu');

  // 2) Fix the calamari model — swap the mis-oriented file for the correct one.
  const { data: calamari, error: calErr } = await db
    .from('dishes')
    .select('model3d')
    .eq('id', CALAMARI_DISH_ID)
    .single();
  if (calErr) throw calErr;

  const newCalamariModel = {
    ...calamari.model3d,
    url: '/firasse_resto/grilled_stuffed_calamari_with_roasted_tomatoes_3d.glb',
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 }, // model is already authored flat — no correction needed
  };
  const { error: updCalErr } = await db
    .from('dishes')
    .update({ model3d: newCalamariModel })
    .eq('id', CALAMARI_DISH_ID);
  if (updCalErr) throw updCalErr;
  console.log('✔ calamari dish now points at the correctly-oriented model');

  // 3) Link a second real dish to the spare pizza model.
  const { data: ultimate, error: ultErr } = await db
    .from('dishes')
    .select('model3d')
    .eq('id', ULTIMATE_PIZZA_ID)
    .single();
  if (ultErr) throw ultErr;

  const newUltimateModel = {
    ...ultimate.model3d,
    url: '/firasse_resto/pizaa3d.glb',
    scale: { x: 1, y: 1, z: 1 },
    position: { x: 0, y: 0, z: 0 },
    animation: 'rotate',
  };
  const { error: updUltErr } = await db
    .from('dishes')
    .update({ model3d: newUltimateModel })
    .eq('id', ULTIMATE_PIZZA_ID);
  if (updUltErr) throw updUltErr;
  console.log('✔ "بيتزا البيبروني الفاخرة بالجبن الذائب" now has a 3D model');

  console.log('\nDone. Real dishes with a working 3D model:');
  console.log('  - بيتزا بيبروني فاخرة (piza3d.glb)');
  console.log('  - حبار محشو مشوي على طريقة المتوسط (grilled_stuffed_calamari...glb, now flat)');
  console.log('  - بيتزا البيبروني الفاخرة بالجبن الذائب (pizaa3d.glb)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
