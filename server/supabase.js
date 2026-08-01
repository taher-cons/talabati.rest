/**
 * Supabase Client Configuration for WebAR Menu
 * Replaces MongoDB/Mongoose with PostgreSQL/Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Admin client (service role - bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Public client (anon key - respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================
// DATA TRANSFORMATION UTILITIES
// ============================================

/**
 * Convert snake_case string to camelCase
 */
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase string to snake_case
 */
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Recursively transform object keys from snake_case to camelCase
 */
function transformKeysToCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(transformKeysToCamel);
  
  const result = {};
  for (const key of Object.keys(obj)) {
    const newKey = snakeToCamel(key);
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[newKey] = transformKeysToCamel(value);
    } else if (Array.isArray(value)) {
      result[newKey] = value.map(transformKeysToCamel);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

/**
 * Recursively transform object keys from camelCase to snake_case
 */
function transformKeysToSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(transformKeysToSnake);
  
  const result = {};
  for (const key of Object.keys(obj)) {
    const newKey = camelToSnake(key);
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[newKey] = transformKeysToSnake(value);
    } else if (Array.isArray(value)) {
      result[newKey] = value.map(transformKeysToSnake);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

/**
 * Transform restaurant data from Supabase to frontend format
 */
function transformRestaurant(row) {
  if (!row) return null;
  const r = transformKeysToCamel(row);
  return {
    ...r,
    _id: r.id,
    logo: r.logoUrl,
    coverImage: r.coverImageUrl,
    primaryColor: r.primaryColor || '#1a1a2e',
    accentColor: r.accentColor || '#e94560',
    secondaryColor: r.secondaryColor || '#16213e',
    socialLinks: r.socialLinks || {},
    openingHours: r.openingHours || {},
    arSettings: r.arSettings || {},
    menus: r.menus || [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  };
}

/**
 * Transform menu data from Supabase to frontend format
 */
function transformMenu(row) {
  if (!row) return null;
  const m = transformKeysToCamel(row);
  return {
    ...m,
    _id: m.id,
    restaurant: m.restaurant ? {
      ...transformKeysToCamel(m.restaurant),
      _id: m.restaurant.id,
      logo: m.restaurant.logoUrl,
      primaryColor: m.restaurant.primaryColor,
      accentColor: m.restaurant.accentColor
    } : undefined,
    categories: m.categories || [],
    dishes: m.dishes || [],
    isActive: m.isActive,
    publishedAt: m.publishedAt,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt
  };
}

/**
 * Transform dish data from Supabase to frontend format
 */
function transformDish(row) {
  if (!row) return null;
  const d = transformKeysToCamel(row);
  return {
    ...d,
    _id: d.id,
    menu: d.menu ? {
      ...transformKeysToCamel(d.menu),
      _id: d.menu.id,
      restaurant: d.menu.restaurant ? {
        ...transformKeysToCamel(d.menu.restaurant),
        _id: d.menu.restaurant.id,
        logo: d.menu.restaurant.logoUrl,
        primaryColor: d.menu.restaurant.primaryColor,
        accentColor: d.menu.restaurant.accentColor
      } : undefined
    } : undefined,
    model3D: d.model3d || d.model3D || {},
    arConfig: d.arConfig || {},
    nutrition: d.nutrition || {},
    isAvailable: d.isAvailable,
    isFeatured: d.isFeatured,
    displayOrder: d.displayOrder,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  };
}

/**
 * Transform restaurant data from frontend to Supabase format
 */
function transformRestaurantInput(data) {
  return {
    name: data.name,
    name_ar: data.nameAr,
    description: data.description,
    description_ar: data.descriptionAr,
    address: data.address,
    phone: data.phone,
    email: data.email,
    website: data.website,
    logo_url: data.logo,
    cover_image_url: data.coverImage,
    primary_color: data.primaryColor,
    secondary_color: data.secondaryColor,
    accent_color: data.accentColor,
    slug: data.slug,
    is_active: data.isActive !== undefined ? data.isActive : true,
    is_published: data.isPublished !== undefined ? data.isPublished : false,
    social_links: data.socialLinks,
    opening_hours: data.openingHours,
    ar_settings: data.arSettings
  };
}

/**
 * Transform menu data from frontend to Supabase format
 */
function transformMenuInput(data) {
  return {
    restaurant_id: data.restaurant || data.restaurantId,
    name: data.name,
    name_ar: data.nameAr,
    description: data.description,
    description_ar: data.descriptionAr,
    language: data.language,
    rtl: data.rtl,
    settings: data.settings,
    is_active: data.isActive !== undefined ? data.isActive : true
  };
}

/**
 * Transform dish data from frontend to Supabase format
 */
function transformDishInput(data) {
  return {
    name: data.name,
    name_ar: data.nameAr,
    description: data.description,
    description_ar: data.descriptionAr,
    price: data.price,
    currency: data.currency,
    category: data.category,
    model3d: data.model3D || data.model3d,
    ar_config: data.arConfig || data.arConfig,
    nutrition: data.nutrition,
    is_available: data.isAvailable !== undefined ? data.isAvailable : true,
    is_featured: data.isFeatured !== undefined ? data.isFeatured : false,
    display_order: data.displayOrder !== undefined ? data.displayOrder : 0
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get restaurant by slug (public)
 */
export async function getRestaurantBySlug(slug) {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Get restaurant by ID (admin)
 */
export async function getRestaurantById(id) {
  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Get active menu for restaurant
 */
export async function getActiveMenu(restaurantId) {
  const { data, error } = await supabase
    .from('menus')
    .select(`
      *,
      categories:categories(*),
      dishes:dishes(*)
    `)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

/**
 * Get menu by ID with all relations (for AR view)
 */
export async function getMenuForAR(menuId) {
  const { data, error } = await supabase.rpc('get_menu_for_ar', { menu_uuid: menuId });
  
  if (error) throw error;
  return data;
}

/**
 * Get single dish with AR config
 */
export async function getDishWithAR(dishId) {
  const { data, error } = await supabase
    .from('dishes')
    .select(`
      *,
      menu:menus(
        id,
        name,
        settings,
        restaurant:restaurants(
          id,
          name,
          ar_settings,
          primary_color,
          accent_color
        )
      )
    `)
    .eq('id', dishId)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Increment dish view counters
 */
export async function incrementDishViews(dishId, type = 'view') {
  const { error } = await supabase.rpc('increment_dish_views', {
    dish_uuid: dishId,
    view_type: type
  });
  
  if (error) console.error('Error incrementing views:', error);
}

/**
 * Get dishes by category
 */
export async function getDishesByCategory(menuId, category) {
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('menu_id', menuId)
    .eq('category', category)
    .eq('is_available', true)
    .order('display_order');
  
  if (error) throw error;
  return data;
}

/**
 * Get featured dishes
 */
export async function getFeaturedDishes(menuId) {
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('menu_id', menuId)
    .eq('is_featured', true)
    .eq('is_available', true)
    .order('display_order', { ascending: false });
  
  if (error) throw error;
  return data;
}

/**
 * Search dishes
 */
export async function searchDishes(menuId, query, category = null) {
  let queryBuilder = supabase
    .from('dishes')
    .select('*')
    .eq('menu_id', menuId)
    .eq('is_available', true);
  
  if (query) {
    queryBuilder = queryBuilder.or(`name.ilike.%${query}%,description.ilike.%${query}%,name_ar.ilike.%${query}%`);
  }
  
  if (category) {
    queryBuilder = queryBuilder.eq('category', category);
  }
  
  queryBuilder = queryBuilder.order('display_order');
  
  const { data, error } = await queryBuilder;
  if (error) throw error;
  return data;
}

/**
 * Get menu analytics
 */
export async function getMenuAnalytics(menuId) {
  const { data, error } = await supabaseAdmin
    .from('menu_stats')
    .select('*')
    .eq('menu_id', menuId)
    .order('date', { ascending: false })
    .limit(30);
  
  if (error) throw error;
  return data;
}

/**
 * Get popular dishes
 */
export async function getPopularDishes(menuId, limit = 10) {
  const { data, error } = await supabaseAdmin
    .from('dishes')
    .select('id, name, name_ar, views, ar_views, orders')
    .eq('menu_id', menuId)
    .or('views.gt.0,ar_views.gt.0')
    .order('views', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
}

/**
 * Get all restaurants (admin)
 */
export async function getAllRestaurants() {
  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .select(`
      *,
      menus:menus!inner(id, name, is_active)
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

/**
 * Get all menus (admin)
 */
export async function getAllMenus() {
  const { data, error } = await supabaseAdmin
    .from('menus')
    .select(`
      *,
      restaurant:restaurants!inner(id, name, name_ar, logo_url, primary_color, accent_color)
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

/**
 * Get all dishes (admin) with optional filters
 */
export async function getAllDishes(filters = {}) {
  let queryBuilder = supabaseAdmin
    .from('dishes')
    .select(`
      *,
      menu:menus!inner(
        id,
        name,
        restaurant:restaurants!inner(id, name, name_ar)
      )
    `);
  
  if (filters.restaurantId) {
    queryBuilder = queryBuilder.eq('menu.restaurant_id', filters.restaurantId);
  }
  
  if (filters.menuId) {
    queryBuilder = queryBuilder.eq('menu_id', filters.menuId);
  }
  
  if (filters.category) {
    queryBuilder = queryBuilder.eq('category', filters.category);
  }
  
  queryBuilder = queryBuilder.order('created_at', { ascending: false });
  
  const { data, error } = await queryBuilder;
  if (error) throw error;
  return data;
}

/**
 * Delete restaurant (admin)
 */
export async function deleteRestaurant(id) {
  const { error } = await supabaseAdmin
    .from('restaurants')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return { success: true };
}

/**
 * Delete menu (admin)
 */
export async function deleteMenu(id) {
  const { error } = await supabaseAdmin
    .from('menus')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return { success: true };
}

/**
 * Create restaurant (admin)
 */
export async function createRestaurant(restaurantData) {
  const transformed = transformRestaurantInput(restaurantData);
  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .insert(transformed)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update restaurant (admin)
 */
export async function updateRestaurant(id, updates) {
  const transformed = transformRestaurantInput(updates);
  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .update(transformed)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Create menu (admin)
 */
export async function createMenu(menuData) {
  const transformed = transformMenuInput(menuData);
  const { data, error } = await supabaseAdmin
    .from('menus')
    .insert(transformed)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update menu (admin)
 */
export async function updateMenu(id, updates) {
  const transformed = transformMenuInput(updates);
  const { data, error } = await supabaseAdmin
    .from('menus')
    .update(transformed)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Add dish to menu (admin)
 */
export async function addDish(menuId, dishData) {
  const transformed = transformDishInput(dishData);
  const { data, error } = await supabaseAdmin
    .from('dishes')
    .insert({ ...transformed, menu_id: menuId })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update dish (admin)
 */
export async function updateDish(dishId, updates) {
  const transformed = transformDishInput(updates);
  const { data, error } = await supabaseAdmin
    .from('dishes')
    .update(transformed)
    .eq('id', dishId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Delete dish (admin)
 */
export async function deleteDish(dishId) {
  const { error } = await supabaseAdmin
    .from('dishes')
    .delete()
    .eq('id', dishId);
  
  if (error) throw error;
  return { success: true };
}

/**
 * Add category (admin)
 */
export async function addCategory(menuId, categoryData) {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert({ ...categoryData, menu_id: menuId })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update category (admin)
 */
export async function updateCategory(categoryId, updates) {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .update(updates)
    .eq('id', categoryId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(bucket, path, fileBuffer, contentType) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, fileBuffer, {
      contentType,
      upsert: false
    });
  
  if (error) throw error;
  
  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(data.path);
  
  return {
    path: data.path,
    publicUrl: urlData.publicUrl
  };
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFile(bucket, path) {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove([path]);
  
  if (error) throw error;
  return { success: true };
}

/**
 * Generate QR code URL for AR experience
 */
export function generateARUrl(menuId) {
  const baseUrl = process.env.CLIENT_URL || 'https://talabati.rest';
  return `${baseUrl}/ar/${menuId}`;
}

/**
 * Generate QR code data URL
 */
export async function generateQRCode(menuId) {
  const arUrl = generateARUrl(menuId);
  // You can use a QR code library here or external API
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(arUrl)}`;
}

// Export transformation utilities for use in routes
export {
  transformKeysToCamel,
  transformKeysToSnake,
  transformRestaurant,
  transformMenu,
  transformDish,
  transformRestaurantInput,
  transformMenuInput,
  transformDishInput
};

export default {
  supabase,
  supabaseAdmin,
  getRestaurantBySlug,
  getRestaurantById,
  getActiveMenu,
  getMenuForAR,
  getDishWithAR,
  incrementDishViews,
  getDishesByCategory,
  getFeaturedDishes,
  searchDishes,
  getMenuAnalytics,
  getPopularDishes,
  getAllRestaurants,
  getAllMenus,
  getAllDishes,
  deleteRestaurant,
  deleteMenu,
  createRestaurant,
  updateRestaurant,
  createMenu,
  updateMenu,
  addDish,
  updateDish,
  deleteDish,
  addCategory,
  updateCategory,
  uploadFile,
  deleteFile,
  generateARUrl,
  generateQRCode
};