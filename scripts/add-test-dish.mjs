#!/usr/bin/env node
/**
 * Add a test dish "اختبار الصورة" with the rubber_duck.glb model
 * to diagnose the 3D rendering issue.
 *
 * Usage:
 *   node scripts/add-test-dish.mjs            # dry run
 *   node scripts/add-test-dish.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const SLUG = 'firasse_food';
const apply = process.argv.includes('--apply');

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Verify the GLB file exists
const glbPath = 'public/firasse_resto/rubber_duck.glb';
if (!existsSync(glbPath)) {
  console.error(`GLB file not found: ${glbPath}`);
  process.exit(1);
}
console.log(`GLB file found: ${glbPath}`);

// Get restaurant
const { data: restaurant } = await db
  .from('restaurants').select('id, name').eq('slug', SLUG).maybeSingle();
if (!restaurant) { console.error(`No restaurant "${SLUG}"`); process.exit(1); }

// Get active menu
const { data: menus } = await db
  .from('menus').select('id, name, is_active, created_at')
  .eq('restaurant_id', restaurant.id)
  .eq('is_active', true)
  .order('created_at', { ascending: false });

const menu = menus?.[0];
if (!menu) { console.error('No active menu.'); process.exit(1); }

// Get Pizzas category
const { data: cats } = await db
  .from('categories').select('id, name').eq('menu_id', menu.id).eq('name', 'Pizzas').maybeSingle();

const categoryId = cats?.id || null;
console.log(`Menu: ${menu.name} (${menu.id})`);
console.log(`Category: Pizzas (${categoryId || 'NOT FOUND'})`);

const dish = {
  menu_id: menu.id,
  category_id: categoryId,
  name: 'Image Test - Rubber Duck',
  name_ar: 'اختبار الصورة - البطة المطاطية',
  description: 'Test dish to diagnose 3D model rendering with rubber duck GLB.',
  description_ar: 'طبق اختباري لتشخيص عرض النموذج ثلاثي الأبعاد باستخدام البطة المطاطية.',
  price: 100,
  currency: 'DZD',
  category: 'Pizzas',
  model3d: {
    url: '/firasse_resto/rubber_duck.glb',
    thumbnail: '/firasse_resto/c1.png',
    scale: { x: 1, y: 1, z: 1 },
    position: { x: 0, y: 0, z: 0 },
    animation: 'rotate'
  },
  is_available: true,
  is_featured: false,
  display_order: 99
};

console.log('\nDish to insert:');
console.log(JSON.stringify(dish, null, 2));

if (!apply) {
  console.log('\nDry run. Re-run with --apply to insert.\n');
  process.exit(0);
}

const { data: inserted, error } = await db
  .from('dishes').insert(dish).select('id, name, name_ar');

if (error) {
  console.error(`Insert failed: ${error.message}`);
  process.exit(1);
}

console.log(`\nInserted dish: ${inserted[0].name_ar} (${inserted[0].id})`);
console.log('Done. Visit /view?dish=<id>&r=firasse_food to test.\n');