#!/usr/bin/env node
/**
 * Pilot menu repair + seed.
 *
 * Two problems were found on the live pilot data:
 *   1. Five menus named "Main Menu" were all flagged `is_active = true`. The
 *      public page only serves the most recent one, so the admin had no way to
 *      tell which menu a dish would land on.
 *   2. The `dishes` table was empty, which is why the customer page rendered
 *      "No dishes available".
 *
 * This script keeps a single served menu, deactivates the duplicates, and seeds
 * a realistic Arabic/French menu priced in DZD so the pilot is demoable.
 *
 * Usage:
 *   node scripts/seed-pilot-menu.mjs <restaurant-slug>            # dry run
 *   node scripts/seed-pilot-menu.mjs <restaurant-slug> --apply
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function loadEnv() {
  try {
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* env may already be exported */ }
}
loadEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const slug = process.argv[2];
const apply = process.argv.includes('--apply');
if (!slug) {
  console.error('Usage: node scripts/seed-pilot-menu.mjs <restaurant-slug> [--apply]');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

// Category names must match `categories.name` exactly: the menu page groups
// dishes by that string.
const DISHES = [
  {
    name: 'Chorba Frik', name_ar: 'شوربة فريك',
    description: 'Traditional Algerian soup with freekeh, lamb and coriander.',
    description_ar: 'شوربة جزائرية تقليدية بالفريك ولحم الغنم والكزبرة.',
    price: 350, category: 'Appetizers', is_featured: false, display_order: 1,
    nutrition: { calories: 210, protein: 12, carbs: 24, fat: 7, allergens: ['gluten'], dietary: [] }
  },
  {
    name: 'Bourek Viande', name_ar: 'بوراك باللحم',
    description: 'Crisp pastry rolls filled with spiced minced beef and onion.',
    description_ar: 'أوراق رقيقة محمّرة محشوة بلحم مفروم متبّل والبصل.',
    price: 450, category: 'Appetizers', is_featured: true, display_order: 2,
    nutrition: { calories: 320, protein: 15, carbs: 28, fat: 16, allergens: ['gluten', 'eggs'], dietary: [] }
  },
  {
    name: 'Couscous Royal', name_ar: 'كسكس ملكي',
    description: 'Steamed semolina with lamb, chicken, merguez and seasonal vegetables.',
    description_ar: 'كسكس بالبخار مع لحم الغنم والدجاج والمرقاز وخضر الموسم.',
    price: 1800, category: 'Main Courses', is_featured: true, display_order: 1,
    nutrition: { calories: 780, protein: 42, carbs: 86, fat: 28, allergens: ['gluten'], dietary: [] }
  },
  {
    name: 'Tajine Zitoune', name_ar: 'طاجين زيتون',
    description: 'Slow-cooked chicken with green olives, mushrooms and lemon.',
    description_ar: 'دجاج مطهو على نار هادئة مع الزيتون الأخضر والفطر والليمون.',
    price: 1500, category: 'Main Courses', is_featured: true, display_order: 2,
    nutrition: { calories: 620, protein: 45, carbs: 18, fat: 38, allergens: [], dietary: ['gluten-free'] }
  },
  {
    name: 'Méchoui d\'Agneau', name_ar: 'مشوي الغنم',
    description: 'Charcoal-grilled lamb shoulder with cumin salt and grilled peppers.',
    description_ar: 'كتف غنم مشوي على الفحم مع ملح الكمون والفلفل المشوي.',
    price: 2400, category: 'Main Courses', is_featured: false, display_order: 3,
    nutrition: { calories: 890, protein: 58, carbs: 6, fat: 68, allergens: [], dietary: ['gluten-free', 'spicy'] }
  },
  {
    name: 'Baklawa', name_ar: 'بقلاوة',
    description: 'Layered filo with almonds and honey syrup, cut in diamonds.',
    description_ar: 'طبقات رقيقة باللوز وقطر العسل، مقطّعة معيّنات.',
    price: 400, category: 'Desserts', is_featured: false, display_order: 1,
    nutrition: { calories: 410, protein: 6, carbs: 52, fat: 21, allergens: ['gluten', 'nuts'], dietary: ['vegetarian'] }
  },
  {
    name: 'Kalb el Louz', name_ar: 'قلب اللوز',
    description: 'Semolina and almond cake soaked in orange-blossom syrup.',
    description_ar: 'كعك السميد واللوز المنقوع في شراب ماء الزهر.',
    price: 350, category: 'Desserts', is_featured: false, display_order: 2,
    nutrition: { calories: 380, protein: 5, carbs: 58, fat: 15, allergens: ['gluten', 'nuts'], dietary: ['vegetarian'] }
  },
  {
    name: 'Thé à la Menthe', name_ar: 'شاي بالنعناع',
    description: 'Green tea with fresh mint and pine nuts.',
    description_ar: 'شاي أخضر بالنعناع الطازج وحبّ الصنوبر.',
    price: 150, category: 'Drinks', is_featured: false, display_order: 1,
    nutrition: { calories: 60, protein: 1, carbs: 14, fat: 1, allergens: ['nuts'], dietary: ['vegan', 'gluten-free'] }
  },
  {
    name: 'Jus d\'Orange Frais', name_ar: 'عصير برتقال طازج',
    description: 'Freshly squeezed Blida oranges, no added sugar.',
    description_ar: 'برتقال البليدة معصور طازجاً، بدون سكر مضاف.',
    price: 250, category: 'Drinks', is_featured: false, display_order: 2,
    nutrition: { calories: 110, protein: 2, carbs: 26, fat: 0, allergens: [], dietary: ['vegan', 'gluten-free'] }
  }
];

// --- locate restaurant + menus ---------------------------------------------
const { data: restaurant } = await db
  .from('restaurants').select('id, name, is_published')
  .eq('slug', slug).maybeSingle();

if (!restaurant) {
  console.error(`No restaurant with slug "${slug}"`);
  process.exit(1);
}

const { data: menus } = await db
  .from('menus').select('id, name, is_active, created_at')
  .eq('restaurant_id', restaurant.id)
  .order('created_at', { ascending: false });

if (!menus?.length) {
  console.error('Restaurant has no menu. Create one from the admin panel first.');
  process.exit(1);
}

const served = menus.find(m => m.is_active) || menus[0];
const duplicates = menus.filter(m => m.id !== served.id && m.is_active);

const { data: existing } = await db
  .from('dishes').select('id, name').eq('menu_id', served.id);

console.log(`\nRestaurant : ${restaurant.name} (${slug})`);
console.log(`Served menu: ${served.name} (${served.id})`);
console.log(`Duplicates to deactivate: ${duplicates.length}`);
console.log(`Dishes already on served menu: ${existing?.length || 0}`);

const toInsert = DISHES.filter(d => !(existing || []).some(e => e.name === d.name));
console.log(`Dishes to insert: ${toInsert.length}`);
toInsert.forEach(d => console.log(`  + ${d.name} (${d.category}) ${d.price} DZD`));

if (!apply) {
  console.log('\nDry run. Re-run with --apply to write these changes.\n');
  process.exit(0);
}

// --- 1. keep exactly one active menu ---------------------------------------
if (duplicates.length) {
  const { error } = await db
    .from('menus')
    .update({ is_active: false })
    .in('id', duplicates.map(m => m.id));
  if (error) throw error;
  console.log(`\nDeactivated ${duplicates.length} duplicate menu(s).`);
}

// --- 2. seed dishes --------------------------------------------------------
if (toInsert.length) {
  const rows = toInsert.map(d => ({
    menu_id: served.id,
    name: d.name,
    name_ar: d.name_ar,
    description: d.description,
    description_ar: d.description_ar,
    price: d.price,
    currency: 'DZD',
    category: d.category,
    nutrition: d.nutrition,
    is_available: true,
    is_featured: d.is_featured,
    display_order: d.display_order
  }));

  const { data, error } = await db.from('dishes').insert(rows).select('id, name');
  if (error) throw error;
  console.log(`Inserted ${data.length} dish(es).`);
}

console.log('\nDone. Open the customer page to verify.\n');
