import express from 'express';
import * as supabaseHelpers from '../supabase.js';
import { requireAdmin } from '../middleware/auth.js';


const {
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
  generateARUrl,
  generateQRCode,
  transformRestaurant,
  transformMenu,
  transformDish,
  transformKeysToCamel
} = supabaseHelpers;

const router = express.Router();

// ============================================
// SHARED HELPERS
// ============================================

// Public payloads MUST be transformed before leaving the API.
// Supabase returns raw snake_case rows (`id`, `is_available`, `logo_url`, `model3d`)
// while every frontend (menu/, ar/, admin/) consumes the camelCase contract
// (`_id`, `isAvailable`, `logo`, `model3D`). Returning raw rows made the menu page
// silently render zero dishes, because `dish.isAvailable` was `undefined` and the
// client-side availability filter dropped every item.
function toPublicMenu(menu) {
  const transformed = transformMenu(menu);
  if (!transformed) return null;
  return {
    ...transformed,
    dishes: (transformed.dishes || []).map(d => transformDish(d)).filter(Boolean),
    categories: (transformed.categories || []).map(c => transformKeysToCamel(c))
  };
}

// A UUID guard keeps `/restaurant/:restaurantId` from forwarding a slug
// (e.g. "menu") into a uuid column, which Postgres rejects with a 500.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================
// PUBLIC API ROUTES
// ============================================

// Get restaurant by slug
router.get('/restaurant/slug/:slug', async (req, res) => {
  try {
    const restaurant = await getRestaurantBySlug(req.params.slug);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(transformRestaurant(restaurant));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get restaurant by ID
router.get('/restaurant/id/:id', async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    const restaurant = await getRestaurantById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(transformRestaurant(restaurant));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active menu for restaurant.
// Accepts either a restaurant UUID or a slug, so `/restaurant/firasse_food`
// resolves instead of blowing up on the uuid cast.
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    let restaurantId = req.params.restaurantId;

    if (!UUID_RE.test(restaurantId)) {
      const restaurant = await getRestaurantBySlug(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      restaurantId = restaurant.id;
    }

    const menu = await getActiveMenu(restaurantId);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    // Increment view count (never let analytics break the response)
    try {
      await incrementDishViews(menu.id, 'menu');
    } catch (_) { /* analytics is best-effort */ }

    res.json(toPublicMenu(menu));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolves a restaurant identifier (uuid OR slug) coming from a query string.
async function resolveRestaurantId(identifier) {
  if (!identifier) return null;
  if (UUID_RE.test(identifier)) return identifier;
  const restaurant = await getRestaurantBySlug(identifier);
  return restaurant ? restaurant.id : null;
}

// Get dishes by category
router.get('/category/:category', async (req, res) => {
  try {
    const restaurantId = await resolveRestaurantId(req.query.restaurantId);
    if (!restaurantId) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const menu = await getActiveMenu(restaurantId);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    
    const dishes = await getDishesByCategory(menu.id, req.params.category);
    res.json((dishes || []).map(d => transformDish(d)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Featured dishes
router.get('/featured', async (req, res) => {
  try {
    const restaurantId = await resolveRestaurantId(req.query.restaurantId);
    if (!restaurantId) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const menu = await getActiveMenu(restaurantId);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    
    const dishes = await getFeaturedDishes(menu.id);
    res.json((dishes || []).map(d => transformDish(d)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search dishes
router.get('/search', async (req, res) => {
  try {
    const { q, category } = req.query;

    const restaurantId = await resolveRestaurantId(req.query.restaurantId);
    if (!restaurantId) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const menu = await getActiveMenu(restaurantId);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    
    const dishes = await searchDishes(menu.id, q, category);
    res.json((dishes || []).map(d => transformDish(d)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single dish with AR config - MUST come before /:menuId
router.get('/dish/:dishId', async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.dishId)) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    const dish = await getDishWithAR(req.params.dishId);
    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }
    
    // Increment AR view count (best-effort, never breaks the response)
    try {
      await incrementDishViews(dish.id, 'ar');
    } catch (_) { /* analytics is best-effort */ }
    
    res.json(transformDish(dish));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get QR code for AR experience
router.get('/qr/:menuId', async (req, res) => {
  try {
    const arUrl = generateARUrl(req.params.menuId);
    const qrCodeUrl = await generateQRCode(req.params.menuId);
    
    res.json({
      arUrl,
      qrCodeUrl,
      menuId: req.params.menuId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN API ROUTES
// ============================================
// SECURITY: every /admin/** route below runs with the Supabase service-role key
// (RLS is bypassed), so authentication is mandatory. Applied here once so no
// future admin route can be added unprotected by accident.
router.use('/admin', requireAdmin);

// Admin - Get all restaurants

router.get('/admin/restaurants', async (req, res) => {
  try {
    const restaurants = await getAllRestaurants();
    const transformed = restaurants.map(r => transformRestaurant(r));
    res.json(transformed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin - Get all menus
router.get('/admin/menus', async (req, res) => {
  try {
    const menus = await getAllMenus();
    const transformed = menus.map(m => transformMenu(m));
    res.json(transformed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin - Get all dishes with optional filters
router.get('/admin/dishes', async (req, res) => {
  try {
    const { restaurantId, menuId, category } = req.query;
    const filters = {};
    if (restaurantId) filters.restaurantId = restaurantId;
    if (menuId) filters.menuId = menuId;
    if (category) filters.category = category;
    
    const dishes = await getAllDishes(filters);
    const transformed = dishes.map(d => transformDish(d));
    res.json(transformed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin - Get analytics
router.get('/admin/analytics/:menuId', async (req, res) => {
  try {
    const analytics = await getMenuAnalytics(req.params.menuId);
    const popularDishes = await getPopularDishes(req.params.menuId);
    
    // Transform popular dishes to frontend format
    const transformedPopular = popularDishes.map(d => ({
      _id: d.id,
      name: d.name,
      nameAr: d.name_ar,
      views: d.views,
      arViews: d.ar_views,
      orders: d.orders,
      conversionRate: d.views > 0 ? ((d.orders / d.views) * 100).toFixed(1) : 0
    }));
    
    // Aggregate analytics stats
    const stats = {
      totalViews: analytics.reduce((sum, a) => sum + (a.total_views || 0), 0),
      totalARViews: analytics.reduce((sum, a) => sum + (a.total_ar_views || 0), 0),
      totalOrders: analytics.reduce((sum, a) => sum + (a.total_orders || 0), 0)
    };
    
    // Category stats (simplified - would need more complex aggregation)
    const categoryStats = [];
    
    res.json({
      stats,
      popularDishes: transformedPopular,
      categoryStats,
      dailyData: analytics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin - Create restaurant
router.post('/admin/restaurant', async (req, res) => {
  try {
    const restaurant = await createRestaurant(req.body);
    res.status(201).json(transformRestaurant(restaurant));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin - Update restaurant
router.put('/admin/restaurant/:id', async (req, res) => {
  try {
    const restaurant = await updateRestaurant(req.params.id, req.body);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(transformRestaurant(restaurant));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin - Delete restaurant
router.delete('/admin/restaurant/:id', async (req, res) => {
  try {
    await deleteRestaurant(req.params.id);
    res.json({ message: 'Restaurant deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin - Create menu
router.post('/admin/menu', async (req, res) => {
  try {
    const menu = await createMenu(req.body);
    res.status(201).json(transformMenu(menu));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin - Update menu
router.put('/admin/menu/:id', async (req, res) => {
  try {
    const menu = await updateMenu(req.params.id, req.body);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    res.json(transformMenu(menu));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin - Delete menu
router.delete('/admin/menu/:id', async (req, res) => {
  try {
    await deleteMenu(req.params.id);
    res.json({ message: 'Menu deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin - Add dish to menu
router.post('/admin/menu/:menuId/dishes', async (req, res) => {
  try {
    const dish = await addDish(req.params.menuId, req.body);
    res.status(201).json(transformDish(dish));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin - Update dish
router.put('/admin/menu/:menuId/dishes/:dishId', async (req, res) => {
  try {
    const dish = await updateDish(req.params.dishId, req.body);
    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }
    res.json(transformDish(dish));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin - Delete dish
router.delete('/admin/menu/:menuId/dishes/:dishId', async (req, res) => {
  try {
    await deleteDish(req.params.dishId);
    res.json({ message: 'Dish deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin - Add category
router.post('/admin/menu/:menuId/categories', async (req, res) => {
  try {
    const category = await addCategory(req.params.menuId, req.body);
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin - Update category
router.put('/admin/menu/:menuId/categories/:categoryId', async (req, res) => {
  try {
    const category = await updateCategory(req.params.categoryId, req.body);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get menu by ID (for AR view) - MUST come after specific routes (catch-all).
// Also accepts a restaurant slug so `/api/menu/firasse_food` resolves to that
// restaurant's active menu instead of returning a uuid-cast 500.
router.get('/:menuId', async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.menuId)) {
      const restaurant = await getRestaurantBySlug(req.params.menuId);
      if (!restaurant) {
        return res.status(404).json({ error: 'Menu not found' });
      }
      const activeMenu = await getActiveMenu(restaurant.id);
      if (!activeMenu) {
        return res.status(404).json({ error: 'Menu not found' });
      }
      return res.json(toPublicMenu(activeMenu));
    }

    const menu = await getMenuForAR(req.params.menuId);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    res.json(toPublicMenu(menu));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
