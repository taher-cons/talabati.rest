#!/usr/bin/env node
/**
 * Menu data diagnostic.
 *
 * The customer-facing page renders whatever `getActiveMenu()` returns: the most
 * recently created menu with `is_active = true`. When a restaurant accumulates
 * several menus, dishes attached to an older menu silently disappear from the
 * public page even though they are perfectly stored in the database.
 *
 * This script prints every menu of a restaurant with its dish count so the
 * mismatch becomes obvious, and can optionally re-attach orphaned dishes to the
 * menu that is actually served.
 *
 * Usage:
 *   node scripts/diagnose-menu.mjs <restaurant-slug>
 *   node scripts/diagnose-menu.mjs <restaurant-slug> --fix
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// --- env -------------------------------------------------------------------
function loadEnv() {
  try {
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* .env is optional when the vars are already exported */ }
}
loadEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const slug = process.argv[2];
const shouldFix = process.argv.includes('--fix');
if (!slug) {
  console.error('Usage: node scripts/diagnose-menu.mjs <restaurant-slug> [--fix]');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

// --- report ----------------------------------------------------------------
const { data: restaurant, error: rErr } = await db
  .from('restaurants')
  .select('id, name, slug, is_published, is_active')
  .eq('slug', slug)
  .maybeSingle();

if (rErr) throw rErr;
if (!restaurant) {
  console.error(`No restaurant with slug "${slug}"`);
  process.exit(1);
}

console.log('\n=== RESTAURANT ===');
console.log(`${restaurant.name}  (${restaurant.id})`);
console.log(`published: ${restaurant.is_published}   active: ${restaurant.is_active}`);
if (!restaurant.is_published) {
  console.log('!! Not published -> the public page returns 404 (RLS blocks anon reads).');
}

const { data: menus, error: mErr } = await db
  .from('menus')
  .select('id, name, is_active, created_at')
  .eq('restaurant_id', restaurant.id)
  .order('created_at', { ascending: false });
if (mErr) throw mErr;

// `select('*')` on purpose: the 3D asset column has been renamed across
// migrations, so hard-coding it makes the diagnostic itself fail.
const { data: dishes, error: dErr } = await db
  .from('dishes')
  .select('*')
  .in('menu_id', menus.map(m => m.id));
if (dErr) throw dErr;

const model3dColumn = ['model_3d', 'model3d_url', 'model_url', 'model_3d_url', 'glb_url']
  .find(c => dishes.length > 0 && c in dishes[0]);
if (dishes.length > 0) {
  console.log('\n=== DISH COLUMNS ===');
  console.log(Object.keys(dishes[0]).join(', '));
}

// The page only ever shows this one:
const served = menus.find(m => m.is_active) || null;

console.log('\n=== MENUS ===');
for (const m of menus) {
  const own = dishes.filter(d => d.menu_id === m.id);
  const visible = own.filter(d => d.is_available !== false);
  const marker = served && m.id === served.id ? '<-- SERVED to customers' : '';
  console.log(`\n[${m.is_active ? 'active  ' : 'inactive'}] ${m.name}  (${m.id}) ${marker}`);
  console.log(`   created: ${m.created_at}`);
  console.log(`   dishes: ${own.length} total / ${visible.length} visible to customers`);
  for (const d of own) {
    const has3d = model3dColumn ? Boolean(d[model3dColumn]) : false;
    console.log(`     - ${d.name} | ${d.price} | ${d.category} | available=${d.is_available} | 3D=${has3d ? 'yes' : 'no'}`);
  }
}

console.log('\n=== DIAGNOSIS ===');
if (!served) {
  console.log('X No active menu -> the page shows "No dishes available".');
  console.log('  Fix: set is_active = true on the menu you want to serve.');
} else {
  const servedDishes = dishes.filter(d => d.menu_id === served.id);
  const orphaned = dishes.filter(d => d.menu_id !== served.id);
  console.log(`Served menu: "${served.name}" with ${servedDishes.length} dish(es).`);
  if (servedDishes.length === 0 && orphaned.length > 0) {
    console.log(`X ${orphaned.length} dish(es) live on OTHER menus and are therefore invisible.`);
    console.log('  Fix: re-run with --fix to move them onto the served menu.');
  } else if (dishes.length === 0) {
    console.log('X The restaurant has no dishes at all. Add dishes from the admin panel.');
  } else if (servedDishes.filter(d => d.is_available !== false).length === 0) {
    console.log('X All dishes are marked unavailable -> hidden by RLS and by the UI.');
  } else {
    console.log('OK Dishes are attached to the served menu and visible.');
  }

  if (shouldFix && orphaned.length > 0) {
    console.log(`\nMoving ${orphaned.length} dish(es) to "${served.name}"...`);
    const { error } = await db
      .from('dishes')
      .update({ menu_id: served.id })
      .in('id', orphaned.map(d => d.id));
    if (error) throw error;
    console.log('Done. Reload the customer page.');
  }
}
console.log('');
