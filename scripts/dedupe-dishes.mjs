#!/usr/bin/env node
/**
 * Remove duplicate dishes from a restaurant's live menu.
 *
 * A duplicate is a dish whose name (or Arabic name) already exists on the same
 * menu. Duplicates happen when the Save button is clicked twice — the admin
 * panel now blocks that, but rows created before the fix are still in the
 * database.
 *
 * The copy that is KEPT is the richest one, not the newest: a dish with a photo
 * and a description is always preferred over an empty twin.
 *
 * Usage:
 *   node scripts/dedupe-dishes.mjs firasse_food            # dry run
 *   node scripts/dedupe-dishes.mjs firasse_food --apply
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const slug = process.argv[2] || 'firasse_food';
const apply = process.argv.includes('--apply');

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/** How much real content a row carries — higher wins. */
function score(dish) {
  let s = 0;
  if (dish.model3d?.thumbnail) s += 4;   // has a photo
  if (dish.model3d?.url) s += 4;         // has a 3D model
  if (dish.description_ar) s += 2;
  if (dish.description) s += 1;
  if (dish.nutrition?.calories) s += 1;
  if (dish.currency && dish.currency !== 'USD') s += 1; // real local currency
  return s;
}

const key = d => (d.name_ar || d.name || '').trim().toLowerCase();

async function main() {
  const { data: restaurant, error: rErr } = await db
    .from('restaurants').select('id, name').eq('slug', slug).single();
  if (rErr || !restaurant) throw new Error(`Restaurant "${slug}" not found`);

  const { data: menus, error: mErr } = await db
    .from('menus').select('id, name, is_active')
    .eq('restaurant_id', restaurant.id).eq('is_active', true)
    .order('created_at', { ascending: false });
  if (mErr) throw mErr;
  if (!menus?.length) throw new Error('No active menu for this restaurant');

  const menu = menus[0]; // the one customers actually see
  console.log(`Restaurant: ${restaurant.name}`);
  console.log(`Live menu:   ${menu.name} (${menu.id})\n`);

  const { data: dishes, error: dErr } = await db
    .from('dishes').select('*').eq('menu_id', menu.id)
    .order('created_at', { ascending: true });
  if (dErr) throw dErr;

  const groups = new Map();
  for (const d of dishes) {
    const k = key(d);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }

  const doomed = [];
  for (const [k, rows] of groups) {
    if (rows.length < 2) continue;
    const sorted = [...rows].sort((a, b) => score(b) - score(a));
    const keep = sorted[0];
    console.log(`"${k}" — ${rows.length} copies`);
    console.log(`   keep   ${keep.id}  (score ${score(keep)}, ${keep.price} ${keep.currency})`);
    for (const drop of sorted.slice(1)) {
      console.log(`   delete ${drop.id}  (score ${score(drop)}, ${drop.price} ${drop.currency})`);
      doomed.push(drop.id);
    }
  }

  if (!doomed.length) {
    console.log('No duplicates found — nothing to do.');
    return;
  }

  if (!apply) {
    console.log(`\nDry run. Re-run with --apply to delete ${doomed.length} duplicate(s).`);
    return;
  }

  const { error } = await db.from('dishes').delete().in('id', doomed);
  if (error) throw error;
  console.log(`\nDeleted ${doomed.length} duplicate dish(es). Live menu is clean.`);
}

main().catch(err => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
