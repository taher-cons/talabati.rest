import express from 'express';
import * as supabaseHelpers from '../supabase.js';

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
  transformKeysToCamel,
  transformRestaurant,
  transformMenu,
  transformDish
} = supabaseHelpers;

const router = express.Router();

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
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get restaurant by ID
router.get('/restaurant/id/:id', async (req, res) => {
  try {
    const restaurant = await getRestaurantById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active menu for restaurant
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const menu = await getActiveMenu(req.params.restaurantId);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    
    // Increment view count
    await incrementDishViews(menu.id, 'menu');
    
    res.json(menu);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get dishes by category
router.get('/category/:category', async (req, res) => {
  try {
    const menu = await getActiveMenu(req.query.restaurantId);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    
    const dishes = await getDishesByCategory(menu.id, req.params.category);
    res.json(dishes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Featured dishes
router.get('/featured', async (req, res) => {
  try {
    const menu = await getActiveMenu(req.query.restaurantId);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    
    const dishes = await getFeaturedDishes(menu.id);
    res.json(dishes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search dishes
router.get('/search', async (req, res) => {
  try {
    const { q, restaurantId, category } = req.query;
    
    const menu = await getActiveMenu(restaurantId);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    
    const dishes = await searchDishes(menu.id, q, category);
    res.json(dishes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single dish with AR config - MUST come before /:menuId
router.get('/dish/:dishId', async (req, res) => {
  try {
    const dish = await getDishWithAR(req.params.dishId);
    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }
    
    // Increment AR view count
    await incrementDishViews(dish.id, 'ar');
    
    res.json(transformDish(dish));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get menu by ID (for AR view) - MUST come after specific routes
router.get('/:menuId', async (req, res) => {
  try {
    const menu = await getMenuForAR(req.params.menuId);
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    res.json(menu);
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

// Admin - Get all restaurants
router.get('/admin/restaurants', async (req, res) => {
  try {
    const restaurants = await getAllRestaurants();
    // Transform to frontend format
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
    // Transform to frontend format
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
    // Transform to frontend format
    const transformed = dishes.map(d => transformDish(d));
    res.json(transformed);
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

export default router;