#!/usr/bin/env node
/**
 * Repair a single dish that was saved with the old admin panel defaults
 * (currency USD, a category the menu does not have, no photo).
 *
 * Usage:
 *   node scripts/fix-dish.mjs <dishId>                       # inspect only
 *   node scripts/fix-dish.mjs <dishId> --apply \
 *        [--currency DZD] [--category Pizzas] \
 *        [--photo /firasse_resto/c3.webp] [--model /firasse_resto/piza3d.glb]
 *
 * NOTE ON CATEGORIES
 * ------------------
 * `menus.categories` (a JSON column) is empty in production — the categories
 * the API and the customer page actually use live elsewhere and are assembled
 * by the API. So this script reads them from the public API, not from that
 * column, otherwise every category looks invalid.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const arg = name => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const dishId = process.argv[2];
const apply = process.argv.includes('--apply');
if (!dishId) {
  console.error('Usage: node scripts/fix-dish.mjs <dishId> [--apply]');
  process.exit(1);
}

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: dish, error } = await db
  .from('dishes').select('*').eq('id', dishId).single();
if (error || !dish) {
  console.error(`Dish not found: ${error?.message || dishId}`);
  process.exit(1);
}

const API = process.env.API_BASE || 'https://talabati.rest';
let menuCategories = [];
try {
  const res = await fetch(`${API}/api/menu/${dish.menu_id}`);
  if (res.ok) {
    const body = await res.json();
    const menu = body.menu || body;
    menuCategories = (menu.categories || []).map(c => c.name);
  }
} catch {
  console.warn('(could not reach the API — category validation skipped)');
}

console.log(`Dish:     ${dish.name_ar || dish.name}`);
console.log(`Price:    ${dish.price} ${dish.currency}`);
const catNote = !menuCategories.length
  ? '(unverified)'
  : menuCategories.includes(dish.category) ? '(valid)' : '(NOT on this menu!)';
console.log(`Category: ${dish.category}  ${catNote}`);
console.log(`Photo:    ${dish.model3d?.thumbnail || '— none —'}`);
console.log(`3D model: ${dish.model3d?.url || '— none —'}`);
console.log(`Menu has: ${menuCategories.join(', ') || '— unknown —'}\n`);

const patch = {};
const currency = arg('currency');
const category = arg('category');
const photo = arg('photo');
const model = arg('model');

if (currency && currency !== dish.currency) patch.currency = currency;
if (category && category !== dish.category) patch.category = category;
if (photo || model) {
  patch.model3d = { ...(dish.model3d || {}) };
  if (photo) patch.model3d.thumbnail = photo;
  if (model) {
    patch.model3d.url = model;
    // Give the viewer sane defaults if the dish never had a model before.
    patch.model3d.scale ??= { x: 1, y: 1, z: 1 };
    patch.model3d.position ??= { x: 0, y: 0, z: 0 };
    patch.model3d.animation ??= 'rotate';
  }
}

if (!Object.keys(patch).length) {
  console.log('Nothing to change.');
  process.exit(0);
}

console.log('Would apply:', JSON.stringify(patch));

if (!apply) {
  console.log('\nDry run. Re-run with --apply to save.');
  process.exit(0);
}

const { error: upErr } = await db.from('dishes').update(patch).eq('id', dishId);
if (upErr) {
  console.error(`Update failed: ${upErr.message}`);
  process.exit(1);
}
console.log('\nSaved.');
