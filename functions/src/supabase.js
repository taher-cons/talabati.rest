/**
 * Supabase Client Configuration for WebAR Menu (Firebase Functions)
 * Replaces MongoDB/Mongoose with PostgreSQL/Supabase
 * Uses lazy initialization to avoid build-time errors
 */

import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase clients
let _supabaseAdmin = null;
let _supabase = null;

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required');
    }
    
    _supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return _supabaseAdmin;
}

function getSupabase() {
  if (!_supabase) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseAnonKey) {
      throw new Error('SUPABASE_ANON_KEY is required');
    }
    
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

// Export lazy-initialized clients via getter properties
// NOTE: We use Object.defineProperty to avoid Proxy-related `this` binding issues
// with Supabase client methods (e.g. .from(), .rpc(), .storage).
let _supabaseAdminSingleton = null;
let _supabaseSingleton = null;

function createSupabaseAdminSingleton() {
  if (!_supabaseAdminSingleton) {
    _supabaseAdminSingleton = getSupabaseAdmin();
  }
  return _supabaseAdminSingleton;
}

function createSupabaseSingleton() {
  if (!_supabaseSingleton) {
    _supabaseSingleton = getSupabase();
  }
  return _supabaseSingleton;
}

// Direct getter exports – each access returns the same initialized client instance
export const supabaseAdmin = {
  get from() { return createSupabaseAdminSingleton().from.bind(createSupabaseAdminSingleton()); },
  get rpc() { return createSupabaseAdminSingleton().rpc.bind(createSupabaseAdminSingleton()); },
  get storage() { return createSupabaseAdminSingleton().storage; },
  get auth() { return createSupabaseAdminSingleton().auth; },
};

export const supabase = {
  get from() { return createSupabaseSingleton().from.bind(createSupabaseSingleton()); },
  get rpc() { return createSupabaseSingleton().rpc.bind(createSupabaseSingleton()); },
  get storage() { return createSupabaseSingleton().storage; },
  get auth() { return createSupabaseSingleton().auth; },
};

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
    ar_config: data.arConfig,
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
  // maybeSingle(), not single(): single() rejects with "Cannot coerce the result
  // to a single JSON object" when there is no match, which surfaced as an HTTP
  // 500 for every unknown slug instead of the 404 the route already handles.
  const { data, error } = await getSupabase()
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}


/**
 * Get restaurant by ID (admin)
 */
export async function getRestaurantById(id) {
  const { data, error } = await getSupabaseAdmin()
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .maybeSingle(); // missing id => null => 404, not a 500

  
  if (error) throw error;
  return data;
}

/**
 * Get active menu for restaurant
 */
export async function getActiveMenu(restaurantId) {
  const { data, error } = await getSupabase()
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
 * Uses direct joins instead of relying on RPC which may not exist.
 */
export async function getMenuForAR(menuId) {
  // Try RPC first (if the PostgreSQL function exists)
  try {
    const { data: rpcData, error: rpcError } = await getSupabase().rpc('get_menu_for_ar', { menu_uuid: menuId });
    if (!rpcError && rpcData) return rpcData;
  } catch (_) {
    // RPC not available – fall through to direct query
  }

  // Fallback: Direct query with joins
  const { data: menu, error: menuError } = await getSupabase()
    .from('menus')
    .select(`
      *,
      restaurant:restaurants(
        id, name, name_ar, description, description_ar,
        logo_url, cover_image_url,
        primary_color, accent_color, secondary_color,
        slug, phone, email, address,
        ar_settings, opening_hours, social_links,
        is_active, is_published
      ),
      categories:categories(*),
      dishes:dishes(*)
    `)
    .eq('id', menuId)
    .eq('is_active', true)
    .maybeSingle(); // unknown/inactive menu => null => clean 404 for the AR page

  if (menuError) throw menuError;
  return menu;
}


/**
 * Get single dish with AR config
 */
export async function getDishWithAR(dishId) {
  const { data, error } = await getSupabase()
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
    .maybeSingle(); // unknown dish => null => 404

  if (error) throw error;
  return data;
}

/**
 * Increment dish view counters
 */

export async function incrementDishViews(dishId, type = 'view') {
  const { error } = await getSupabase().rpc('increment_dish_views', {
    dish_uuid: dishId,
    view_type: type
  });
  
  if (error) console.error('Error incrementing views:', error);
}

/**
 * Get dishes by category
 */
export async function getDishesByCategory(menuId, category) {
  const { data, error } = await getSupabase()
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
  const { data, error } = await getSupabase()
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
  let queryBuilder = getSupabase()
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
  const { data, error } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin()
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
  let queryBuilder = getSupabaseAdmin()
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
  const { error } = await getSupabaseAdmin()
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
  const { error } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin()
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
  const { error } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin()
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
  const { data, error } = await getSupabaseAdmin().storage
    .from(bucket)
    .upload(path, fileBuffer, {
      contentType,
      upsert: false
    });
  
  if (error) throw error;
  
  // Get public URL
  const { data: urlData } = getSupabaseAdmin().storage
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
  const { error } = await getSupabaseAdmin().storage
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

export { getSupabaseAdmin, getSupabase };

export default {
  get supabase() { return getSupabase(); },
  get supabaseAdmin() { return getSupabaseAdmin(); },
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
