#!/usr/bin/env node
/**
 * Replace the placeholder pilot menu with Firasse Food's real dishes.
 *
 * Source of truth: obs_58.txt (names, descriptions, prices, tags) and the four
 * photos in public/firasse_resto/.
 *
 * IMPORTANT SCHEMA NOTE
 * ---------------------
 * The `dishes` table has NO image column (no `image`, no `image_url`). The only
 * image field the API round-trips today is `model3d.thumbnail`, which the menu
 * page reads first:
 *     dish.model3D?.thumbnail || dish.image || dish.imageUrl || placeholder
 * So the 2D photo is stored there. If an `image_url` column is added later,
 * migrate these values across and keep `thumbnail` for the 3D preview only.
 *
 * Usage:
 *   node scripts/seed-firasse-real.mjs            # dry run
 *   node scripts/seed-firasse-real.mjs --apply
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

// Categories the real menu needs, in display order.
const CATEGORIES = [
  { name: 'Starters',  name_ar: 'المقبلات',        icon: '🥟', display_order: 1 },
  { name: 'Pizzas',    name_ar: 'البيتزا',          icon: '🍕', display_order: 2 },
  { name: 'Seafood',   name_ar: 'المأكولات البحرية', icon: '🦑', display_order: 3 }
];

// Photos are matched to dishes in the order they appear in obs_58.txt:
// c1 → calamari, c2 → napoletana, c3 → pepperoni, c4 → croquette.
const DISHES = [
  {
    image: '/firasse_resto/c1.png',
    name: 'Mediterranean Stuffed Calamari',
    name_ar: 'حبار محشو مشوي على طريقة المتوسط',
    description: 'Fresh calamari stuffed with herbed rice, charcoal-grilled, served with roasted cherry tomato salad and pine nuts.',
    description_ar: 'حبار طازج محشو بأرز الأعشاب المعطرة، مشوي على الفحم، يقدم مع سلطة الطماطم الكرزية المحمصة والصنوبر.',
    price: 1800,
    category: 'Seafood',
    is_featured: true,
    display_order: 1,
    nutrition: { calories: 520, protein: 38, carbs: 34, fat: 22, allergens: ['seafood', 'nuts'], dietary: ['مأكولات بحرية', 'طبق رئيسي', 'صحي'] }
  },
  {
    image: '/firasse_resto/c2.webp',
    name: 'Pizza Napoletana Tradizionale',
    name_ar: 'بيتزا نابولي الإيطالية الفاخرة',
    description: 'Airy slow-fermented Neapolitan dough with Italian tomato sauce, premium mozzarella, salted anchovies, capers and black olives.',
    description_ar: 'عجينة نابوليتانية هشة ومختمرة، محضرة بصلصة الطماطم الإيطالية، جبن الموزاريلا الفاخر، قطع الأنشوفة الحادقة، الكبار والزيتون الأسود.',
    price: 1200,
    category: 'Pizzas',
    is_featured: false,
    display_order: 1,
    nutrition: { calories: 780, protein: 32, carbs: 88, fat: 30, allergens: ['gluten', 'dairy', 'fish'], dietary: ['بيتزا', 'طعام إيطالي', 'حطب'] }
  },
  {
    image: '/firasse_resto/c3.webp',
    name: 'Ultimate Cheese & Pepperoni Pizza',
    name_ar: 'بيتزا البيبروني الفاخرة بالجبن الذائب',
    description: 'Golden Italian dough with a crisp crust, loaded with melted mozzarella, crispy beef pepperoni and a touch of wild herbs.',
    description_ar: 'عجينة إيطالية محمرة بحواف مقرمشة، غنية بجبنة الموزاريلا المذابة وشرائح البيبروني البقري المقرمش مع لمسة أعشاب برية.',
    price: 1400,
    category: 'Pizzas',
    is_featured: true,
    display_order: 2,
    nutrition: { calories: 950, protein: 42, carbs: 92, fat: 44, allergens: ['gluten', 'dairy'], dietary: ['الأكثر مبيعاً', 'بيتزا', 'أجبان'] }
  },
  {
    image: '/firasse_resto/c4.webp',
    name: 'Cheesy Crispy Chicken Croquette',
    name_ar: 'كروكيت الدجاج المقرمش محشو بالجبن الذائب',
    description: 'Golden crispy chicken with a rich molten cheese core, served on a bed of fresh lettuce, corn and tomato salad with house sauces.',
    description_ar: 'قطعة دجاج مقرمشة وذهبية محشوة بقلب غني من الجبن الذائب، تقدم على فراش من الخس الطازج، الذرة، وسلطة الطماطم مع صوصات خاصة.',
    price: 900,
    category: 'Starters',
    is_featured: true,
    display_order: 1,
    nutrition: { calories: 610, protein: 34, carbs: 46, fat: 32, allergens: ['gluten', 'dairy', 'eggs'], dietary: ['مقرمش', 'مقبلات', 'جبن ذائب'] }
  }
];

// --- sanity: every photo must exist before touching the database ------------
const missing = DISHES.filter(d => !existsSync(`public${d.image}`));
if (missing.length) {
  console.error('Missing image files:');
  missing.forEach(d => console.error(`  public${d.image}`));
  process.exit(1);
}

const { data: restaurant } = await db
  .from('restaurants').select('id, name').eq('slug', SLUG).maybeSingle();
if (!restaurant) { console.error(`No restaurant "${SLUG}"`); process.exit(1); }

const { data: menus } = await db
  .from('menus').select('id, name, is_active, created_at')
  .eq('restaurant_id', restaurant.id)
  .eq('is_active', true)
  .order('created_at', { ascending: false });

const menu = menus?.[0];
if (!menu) { console.error('No active menu.'); process.exit(1); }

const { data: oldDishes } = await db
  .from('dishes').select('id, name').eq('menu_id', menu.id);
const { data: oldCats } = await db
  .from('categories').select('id, name').eq('menu_id', menu.id);

console.log(`\nRestaurant : ${restaurant.name}`);
console.log(`Served menu: ${menu.name} (${menu.id})`);
console.log(`\nDishes to remove (${oldDishes?.length || 0}):`);
(oldDishes || []).forEach(d => console.log(`  - ${d.name}`));
console.log(`\nCategories to remove (${oldCats?.length || 0}):`);
(oldCats || []).forEach(c => console.log(`  - ${c.name}`));
console.log(`\nCategories to create: ${CATEGORIES.map(c => c.name).join(', ')}`);
console.log(`\nDishes to insert (${DISHES.length}):`);
DISHES.forEach(d => console.log(`  + ${d.name_ar} | ${d.price} DZD | ${d.category} | ${d.image}`));

if (!apply) {
  console.log('\nDry run. Re-run with --apply to write these changes.\n');
  process.exit(0);
}

// --- 1. clear the placeholder menu -----------------------------------------
if (oldDishes?.length) {
  const { error } = await db.from('dishes').delete().eq('menu_id', menu.id);
  if (error) throw error;
  console.log(`\nRemoved ${oldDishes.length} placeholder dish(es).`);
}
if (oldCats?.length) {
  const { error } = await db.from('categories').delete().eq('menu_id', menu.id);
  if (error) throw error;
  console.log(`Removed ${oldCats.length} placeholder category(ies).`);
}

// --- 2. real categories ----------------------------------------------------
const { data: cats, error: catErr } = await db
  .from('categories')
  .insert(CATEGORIES.map(c => ({ ...c, menu_id: menu.id, is_active: true })))
  .select('id, name');
if (catErr) throw catErr;
console.log(`Created ${cats.length} category(ies).`);

const catId = Object.fromEntries(cats.map(c => [c.name, c.id]));

// --- 3. real dishes --------------------------------------------------------
const rows = DISHES.map(d => ({
  menu_id: menu.id,
  category_id: catId[d.category] ?? null,
  name: d.name,
  name_ar: d.name_ar,
  description: d.description,
  description_ar: d.description_ar,
  price: d.price,
  currency: 'DZD',
  category: d.category,
  // 2D photo lives in model3d.thumbnail — see schema note at the top.
  model3d: { thumbnail: d.image },
  nutrition: d.nutrition,
  is_available: true,
  is_featured: d.is_featured,
  display_order: d.display_order
}));

const { data: inserted, error: dishErr } = await db
  .from('dishes').insert(rows).select('id, name');
if (dishErr) throw dishErr;
console.log(`Inserted ${inserted.length} real dish(es).`);

console.log('\nDone. Hard-reload the menu page to verify.\n');
