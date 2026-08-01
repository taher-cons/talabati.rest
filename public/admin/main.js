/**
 * WebAR Menu - Admin Panel
 * Handles dashboard, CRUD operations, and settings management
 */

import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';

// ============================================
// CONFIGURATION & STATE
// ============================================
const CONFIG = {
  apiBase: '/api/menu',
  uploadBase: '/api/upload',
  pageSize: 20
};

const state = {
  currentPage: 'dashboard',
  sidebarCollapsed: false,
  userMenuOpen: false,
  restaurants: [],
  menus: [],
  dishes: [],
  models: [],
  analytics: null,
  editingId: null,
  editingType: null
};

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {};

function initDOMElements() {
  // Layout
  elements.sidebar = document.getElementById('sidebar');
  elements.sidebarToggle = document.getElementById('sidebar-toggle');
  elements.mobileMenuBtn = document.getElementById('mobile-menu-btn');
  elements.mainContent = document.getElementById('main-content');
  elements.pageTitle = document.getElementById('page-title');
  elements.pageContent = document.getElementById('page-content');
  
  // Navigation
  elements.navLinks = document.querySelectorAll('.nav-link');
  
  // User menu
  elements.userMenuTrigger = document.getElementById('user-menu-trigger');
  elements.userDropdown = document.getElementById('user-dropdown');
  elements.btnLogout = document.getElementById('btn-logout');
  elements.dropdownLogout = document.getElementById('dropdown-logout');
  
  // Pages
  elements.pages = document.querySelectorAll('.page');
  
  // Dashboard stats
  elements.statRestaurants = document.getElementById('stat-restaurants');
  elements.statMenus = document.getElementById('stat-menus');
  elements.statDishes = document.getElementById('stat-dishes');
  elements.statModels = document.getElementById('stat-models');
  elements.recentActivity = document.getElementById('recent-activity');
  
  // Quick actions
  elements.actionBtns = document.querySelectorAll('.action-btn');
  
  // Restaurant table
  elements.restaurantsTbody = document.getElementById('restaurants-tbody');
  elements.btnAddRestaurant = document.getElementById('btn-add-restaurant');
  
  // Menu table
  elements.menusTbody = document.getElementById('menus-tbody');
  elements.btnAddMenu = document.getElementById('btn-add-menu');
  elements.menuRestaurantSelect = document.getElementById('menu-restaurant');
  
  // Dish table
  elements.dishesTbody = document.getElementById('dishes-tbody');
  elements.btnAddDish = document.getElementById('btn-add-dish');
  elements.filterRestaurant = document.getElementById('filter-restaurant');
  elements.filterCategory = document.getElementById('filter-category');
  elements.dishMenuSelect = document.getElementById('dish-menu');
  
  // Models
  elements.modelsGrid = document.getElementById('models-grid');
  elements.btnUploadModel = document.getElementById('btn-upload-model');
  elements.btnUploadModel2 = document.getElementById('btn-upload-model-2');
  elements.modelDishSelect = document.getElementById('model-dish');
  
  // Analytics
  elements.analyticsMenu = document.getElementById('analytics-menu');
  elements.analyticsPeriod = document.getElementById('analytics-period');
  elements.analyticsViews = document.getElementById('analytics-views');
  elements.analyticsArViews = document.getElementById('analytics-ar-views');
  elements.analyticsOrders = document.getElementById('analytics-orders');
  elements.analyticsConversion = document.getElementById('analytics-conversion');
  elements.popularDishesTbody = document.getElementById('popular-dishes-tbody');
  elements.categoryPerformance = document.getElementById('category-performance');
  
  // Modals
  elements.restaurantModal = document.getElementById('restaurant-modal');
  elements.restaurantForm = document.getElementById('restaurant-form');
  elements.restaurantModalTitle = document.getElementById('restaurant-modal-title');
  elements.restaurantId = document.getElementById('restaurant-id');
  
  elements.menuModal = document.getElementById('menu-modal');
  elements.menuForm = document.getElementById('menu-form');
  elements.menuModalTitle = document.getElementById('menu-modal-title');
  elements.menuId = document.getElementById('menu-id');
  
  elements.dishModal = document.getElementById('dish-modal');
  elements.dishForm = document.getElementById('dish-form');
  elements.dishModalTitle = document.getElementById('dish-modal-title');
  elements.dishId = document.getElementById('dish-id');
  elements.dishMenuId = document.getElementById('dish-menu-id');
  
  elements.modelUploadModal = document.getElementById('model-upload-modal');
  elements.modelUploadForm = document.getElementById('model-upload-form');
  
  // Modal close buttons
  elements.modalCloseBtns = document.querySelectorAll('.modal-close, [data-dismiss="modal"]');
  
  // Toast
  elements.toastContainer = document.getElementById('toast-container');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showToast(message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'
  };
  
  toast.innerHTML = `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${icons[type] || icons.info}
    </svg>
    <span>${message}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  gsap.fromTo(toast, 
    { opacity: 0, x: 100 },
    { opacity: 1, x: 0, duration: 0.4, ease: 'back.out(1.7)' }
  );
  
  setTimeout(() => {
    gsap.to(toast, {
      opacity: 0,
      x: 100,
      duration: 0.3,
      onComplete: () => toast.remove()
    });
  }, duration);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusBadge(status, type = 'default') {
  const badges = {
    active: '<span class="badge badge-active">Active</span>',
    inactive: '<span class="badge badge-inactive">Inactive</span>',
    published: '<span class="badge badge-published">Published</span>',
    draft: '<span class="badge badge-draft">Draft</span>',
    true: '<span class="badge badge-yes">Yes</span>',
    false: '<span class="badge badge-no">No</span>',
    yes: '<span class="badge badge-yes">Yes</span>',
    no: '<span class="badge badge-no">No</span>'
  };
  return badges[status] || `<span class="badge">${status}</span>`;
}

function createActionButtons(type, id, extraClass = '') {
  return `
    <div class="actions-cell">
      <button class="action-btn-sm edit-btn ${extraClass}" data-type="${type}" data-id="${id}" aria-label="Edit">
        <i class="ti ti-edit"></i>
      </button>
      <button class="action-btn-sm delete-btn ${extraClass}" data-type="${type}" data-id="${id}" aria-label="Delete">
        <i class="ti ti-trash"></i>
      </button>
    </div>
  `;
}

// ============================================
// API FUNCTIONS
// ============================================
// --------------------------------------------
// ADMIN CREDENTIALS
// The API now rejects unauthenticated calls to /admin/** and /upload/**.
// The key lives in sessionStorage only: it is gone when the tab closes, and it
// is never written to localStorage (which survives on shared/kiosk devices).
// --------------------------------------------
const ADMIN_KEY_STORAGE = 'talabati_admin_key';

function getAdminKey() {
  return sessionStorage.getItem(ADMIN_KEY_STORAGE) || '';
}

function setAdminKey(key) {
  if (key) sessionStorage.setItem(ADMIN_KEY_STORAGE, key.trim());
}

function clearAdminKey() {
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

/** Asks for the admin key once per tab. Returns '' if the user cancels. */
function promptAdminKey(message = 'Enter the admin API key to continue:') {
  const key = window.prompt(message);
  if (key) {
    setAdminKey(key);
    return key.trim();
  }
  return '';
}

function ensureAdminKey() {
  return getAdminKey() || promptAdminKey();
}

function authHeaders(extra = {}) {
  const key = getAdminKey();
  return key ? { ...extra, 'x-admin-key': key } : { ...extra };
}

/** On 401/403 the stored key is wrong — drop it and ask again. */
function handleAuthFailure(status) {
  if (status === 401 || status === 403) {
    clearAdminKey();
    showToast('Authentication failed — please re-enter the admin key', 'error');
    promptAdminKey('The admin key was rejected. Enter it again:');
    return true;
  }
  return false;
}

async function apiRequest(endpoint, options = {}) {
  const url = `${CONFIG.apiBase}${endpoint}`;

  // Admin endpoints require credentials; public reads must not send them.
  if (endpoint.startsWith('/admin')) ensureAdminKey();

  const response = await fetch(url, {
    ...options,
    headers: authHeaders({
      'Content-Type': 'application/json',
      ...(options.headers || {})
    })
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = { error: `Unexpected response (HTTP ${response.status})` };
  }

  if (!response.ok) {
    handleAuthFailure(response.status);
    throw new Error(data.error || `Request failed (HTTP ${response.status})`);
  }

  return data;
}

async function uploadFile(endpoint, formData) {
  ensureAdminKey();

  // NOTE: no Content-Type here on purpose — the browser must set the multipart
  // boundary itself, otherwise multer cannot parse the body.
  const response = await fetch(`${CONFIG.uploadBase}${endpoint}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = { error: `Unexpected response (HTTP ${response.status})` };
  }

  if (!response.ok) {
    handleAuthFailure(response.status);
    throw new Error(data.error || `Upload failed (HTTP ${response.status})`);
  }

  return data;
}


// ============================================
// DATA FETCHING
// ============================================
async function fetchRestaurants() {
  try {
    const data = await apiRequest('/admin/restaurants');
    state.restaurants = data;
    return data;
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    showToast('Failed to load restaurants', 'error');
    return [];
  }
}

async function fetchMenus() {
  try {
    const data = await apiRequest('/admin/menus');
    state.menus = data;
    return data;
  } catch (error) {
    console.error('Error fetching menus:', error);
    showToast('Failed to load menus', 'error');
    return [];
  }
}

async function fetchDishes(filters = {}) {
  try {
    const params = new URLSearchParams(filters).toString();
    const data = await apiRequest(`/admin/dishes?${params}`);
    state.dishes = data;
    return data;
  } catch (error) {
    console.error('Error fetching dishes:', error);
    showToast('Failed to load dishes', 'error');
    return [];
  }
}

async function fetchModels() {
  try {
    // This would need a models endpoint
    state.models = [];
    return [];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

async function fetchAnalytics(menuId = '', period = '30d') {
  try {
    // If no menuId provided, use the first active menu's ID
    let targetMenuId = menuId;
    if (!targetMenuId && state.menus && state.menus.length > 0) {
      const activeMenu = state.menus.find(m => m.isActive) || state.menus[0];
      targetMenuId = activeMenu?._id || '';
    }
    
    if (!targetMenuId) {
      console.warn('No menu ID available for analytics');
      return null;
    }
    
    const params = new URLSearchParams({ period }).toString();
    const data = await apiRequest(`/admin/analytics/${targetMenuId}?${params}`);
    state.analytics = data;
    return data;
  } catch (error) {
    console.error('Error fetching analytics:', error);
    showToast('Failed to load analytics', 'error');
    return null;
  }
}

async function fetchAllData() {
  await Promise.all([
    fetchRestaurants(),
    fetchMenus(),
    fetchDishes()
  ]);
  
  updateDashboardStats();
  populateRestaurantSelects();
  populateMenuSelects();
  renderRestaurantsTable();
  renderMenusTable();
  renderDishesTable();
  renderModelsGrid();
}

// ============================================
// UI RENDERING
// ============================================
function updateDashboardStats() {
  const restaurantCount = state.restaurants.length;
  const menuCount = state.menus.filter(m => m.isActive).length;
  const dishCount = state.dishes.filter(d => d.isAvailable).length;
  const modelCount = state.dishes.filter(d => d.model3D?.url).length;
  
  animateNumber(elements.statRestaurants, restaurantCount);
  animateNumber(elements.statMenus, menuCount);
  animateNumber(elements.statDishes, dishCount);
  animateNumber(elements.statModels, modelCount);
}

function animateNumber(element, target) {
  if (!element) return;
  const start = parseInt(element.textContent) || 0;
  const duration = 800;
  const startTime = Date.now();
  
  function update() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);
    element.textContent = current.toLocaleString();
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

function populateRestaurantSelects() {
  // Populate restaurant selects
  const restaurantSelects = [
    elements.menuRestaurantSelect,
    elements.filterRestaurant
  ];
  
  restaurantSelects.forEach(select => {
    if (!select) return;
    const currentValue = select.value;
    const firstOption = select.querySelector('option');
    select.innerHTML = firstOption ? firstOption.outerHTML : '';
    
    state.restaurants.forEach(restaurant => {
      const option = document.createElement('option');
      option.value = restaurant._id;
      option.textContent = restaurant.name;
      select.appendChild(option);
    });
    
    select.value = currentValue;
  });
  
  // Populate analytics menu select with menus
  if (elements.analyticsMenu) {
    const currentValue = elements.analyticsMenu.value;
    const firstOption = elements.analyticsMenu.querySelector('option');
    elements.analyticsMenu.innerHTML = firstOption ? firstOption.outerHTML : '';
    
    state.menus.forEach(menu => {
      const option = document.createElement('option');
      option.value = menu._id;
      option.textContent = menu.name;
      elements.analyticsMenu.appendChild(option);
    });
    
    elements.analyticsMenu.value = currentValue;
  }
}

function populateMenuSelects() {
  const selects = [elements.dishMenuSelect, elements.menuRestaurantSelect];
  
  selects.forEach(select => {
    if (!select || select.id === 'menu-restaurant') return;
    const currentValue = select.value;
    const firstOption = select.querySelector('option');
    select.innerHTML = firstOption ? firstOption.outerHTML : '';
    
    state.menus.filter(m => m.isActive).forEach(menu => {
      const option = document.createElement('option');
      option.value = menu._id;
      option.textContent = `${menu.name} (${menu.restaurant?.name || 'Unknown'})`;
      select.appendChild(option);
    });
    
    select.value = currentValue;
  });
}

function renderRestaurantsTable() {
  if (!elements.restaurantsTbody) return;
  
  elements.restaurantsTbody.innerHTML = state.restaurants.map(restaurant => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          ${restaurant.logo ? `<img src="${restaurant.logo}" alt="" style="width: 36px; height: 36px; border-radius: 8px; object-fit: cover;">` : '<div style="width: 36px; height: 36px; border-radius: 8px; background: var(--accent-color); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">' + restaurant.name.charAt(0) + '</div>'}
          <div>
            <div style="font-weight: 500;">${restaurant.name}</div>
            ${restaurant.nameAr ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${restaurant.nameAr}</div>` : ''}
          </div>
        </div>
      </td>
      <td><code style="font-size: 0.75rem;">${restaurant.slug}</code></td>
      <td>${getStatusBadge(restaurant.isPublished ? 'published' : 'draft')}</td>
      <td>${restaurant.menus?.length || 0}</td>
      <td>${formatDate(restaurant.createdAt)}</td>
      ${createActionButtons('restaurant', restaurant._id)}
    </tr>
  `).join('');
  
  attachTableActionListeners('restaurant');
}

function renderMenusTable() {
  if (!elements.menusTbody) return;
  
  elements.menusTbody.innerHTML = state.menus.map(menu => `
    <tr>
      <td>
        <div style="font-weight: 500;">${menu.name}</div>
        ${menu.nameAr ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${menu.nameAr}</div>` : ''}
      </td>
      <td>${menu.restaurant?.name || 'Unknown'}</td>
      <td>${menu.categories?.length || 0}</td>
      <td>${menu.dishes?.length || 0}</td>
      <td>${getStatusBadge(menu.isActive ? 'active' : 'inactive')}</td>
      <td>${getStatusBadge(menu.settings?.enableAR ? 'yes' : 'no')}</td>
      ${createActionButtons('menu', menu._id)}
    </tr>
  `).join('');
  
  attachTableActionListeners('menu');
}

function renderDishesTable() {
  if (!elements.dishesTbody) return;
  
  elements.dishesTbody.innerHTML = state.dishes.map(dish => `
    <tr>
      <td>
        ${dish.model3D?.thumbnail ? 
          `<img src="${dish.model3D.thumbnail}" alt="" style="width: 48px; height: 36px; border-radius: 6px; object-fit: cover;">` :
          '<div style="width: 48px; height: 36px; border-radius: 6px; background: var(--surface); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.75rem;">No Image</div>'
        }
      </td>
      <td>
        <div style="font-weight: 500;">${dish.name}</div>
        ${dish.nameAr ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${dish.nameAr}</div>` : ''}
      </td>
      <td>${dish.menu?.restaurant?.name || dish.menu?.name || 'Unknown'}</td>
      <td>${dish.category.charAt(0).toUpperCase() + dish.category.slice(1)}</td>
      <td style="font-weight: 600; color: var(--accent-color);">${dish.price.toFixed(2)} ${dish.currency}</td>
      <td>${getStatusBadge(dish.model3D?.url ? 'yes' : 'no')}</td>
      <td>${getStatusBadge(dish.isFeatured ? 'yes' : 'no')}</td>
      <td>${getStatusBadge(dish.isAvailable ? 'yes' : 'no')}</td>
      ${createActionButtons('dish', dish._id)}
    </tr>
  `).join('');
  
  attachTableActionListeners('dish');
}

function renderModelsGrid() {
  if (!elements.modelsGrid) return;
  
  const dishesWithModels = state.dishes.filter(d => d.model3D?.url);
  
  if (dishesWithModels.length === 0) {
    elements.modelsGrid.innerHTML = `
      <div class="model-empty">
        <i class="ti ti-cube"></i>
        <h3>No 3D Models</h3>
        <p>Upload GLB/GLTF models for your dishes</p>
        <button class="btn btn-primary" id="btn-upload-model-2">
          <i class="ti ti-upload"></i>
          <span>Upload Model</span>
        </button>
      </div>
    `;
    document.getElementById('btn-upload-model-2')?.addEventListener('click', () => openModelUploadModal());
    return;
  }
  
  elements.modelsGrid.innerHTML = dishesWithModels.map(dish => `
    <div class="model-card" data-dish-id="${dish._id}">
      <div class="model-preview">
        <img src="${dish.model3D.thumbnail || ''}" alt="${dish.name}" loading="lazy">
        <span class="model-type">${dish.model3D.url.endsWith('.glb') ? 'GLB' : 'GLTF'}</span>
      </div>
      <div class="model-info">
        <div class="model-name">${dish.name}</div>
        <div class="model-meta">
          <span>${dish.menu?.restaurant?.name || dish.menu?.name}</span>
          <span>${dish.category}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function renderAnalytics(data) {
  if (!data) return;
  
  animateNumber(elements.analyticsViews, data.stats?.totalViews || 0);
  animateNumber(elements.analyticsArViews, data.stats?.totalARViews || 0);
  animateNumber(elements.analyticsOrders, data.stats?.totalOrders || 0);
  
  const conversion = data.stats?.totalViews > 0 
    ? ((data.stats.totalOrders / data.stats.totalViews) * 100).toFixed(1)
    : 0;
  animateNumber(elements.analyticsConversion, parseFloat(conversion));
  
  // Popular dishes
  if (elements.popularDishesTbody && data.popularDishes) {
    elements.popularDishesTbody.innerHTML = data.popularDishes.map(dish => `
      <tr>
        <td>${dish.name}</td>
        <td>${dish.views.toLocaleString()}</td>
        <td>${dish.arViews.toLocaleString()}</td>
        <td>${dish.orders.toLocaleString()}</td>
        <td>${dish.conversionRate}%</td>
      </tr>
    `).join('');
  }
  
  // Category performance
  if (elements.categoryPerformance && data.categoryStats) {
    elements.categoryPerformance.innerHTML = data.categoryStats.map((cat, index) => {
      const colors = ['primary', 'success', 'warning', 'danger', 'info', 'accent'];
      const color = colors[index % colors.length];
      const maxDishes = Math.max(...data.categoryStats.map(c => c.dishCount));
      const width = maxDishes > 0 ? (cat.dishCount / maxDishes) * 100 : 0;
      
      return `
        <div class="performance-bar">
          <div class="performance-header">
            <span class="performance-name">${cat.name}</span>
            <span class="performance-value">${cat.dishCount} dishes</span>
          </div>
          <div class="performance-track">
            <div class="performance-fill ${color}" style="width: ${width}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ============================================
// MODAL MANAGEMENT
// ============================================
function openModal(modal) {
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  
  gsap.fromTo(modal,
    { opacity: 0 },
    { opacity: 1, duration: 0.2 }
  );
  
  gsap.fromTo(modal.querySelector('.modal-content'),
    { scale: 0.95, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }
  );
}

function closeModal(modal) {
  gsap.to(modal, {
    opacity: 0,
    duration: 0.2,
    onComplete: () => {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  });
}

function openRestaurantModal(restaurant = null) {
  state.editingType = 'restaurant';
  state.editingId = restaurant?._id || null;
  
  elements.restaurantModalTitle.textContent = restaurant ? 'Edit Restaurant' : 'Add Restaurant';
  elements.restaurantForm.reset();
  elements.restaurantId.value = restaurant?._id || '';
  
  if (restaurant) {
    document.getElementById('restaurant-name').value = restaurant.name || '';
    document.getElementById('restaurant-name-ar').value = restaurant.nameAr || '';
    document.getElementById('restaurant-slug').value = restaurant.slug || '';
    document.getElementById('restaurant-phone').value = restaurant.phone || '';
    document.getElementById('restaurant-email').value = restaurant.email || '';
    document.getElementById('restaurant-address').value = restaurant.address || '';
    document.getElementById('restaurant-description').value = restaurant.description || '';
    document.getElementById('restaurant-primary-color').value = restaurant.primaryColor || '#1a1a2e';
    document.getElementById('restaurant-accent-color').value = restaurant.accentColor || '#e94560';
    document.getElementById('restaurant-published').checked = restaurant.isPublished || false;
  }
  
  openModal(elements.restaurantModal);
}

function openMenuModal(menu = null) {
  state.editingType = 'menu';
  state.editingId = menu?._id || null;
  
  elements.menuModalTitle.textContent = menu ? 'Edit Menu' : 'Create Menu';
  elements.menuForm.reset();
  elements.menuId.value = menu?._id || '';
  
  if (menu) {
    document.getElementById('menu-name').value = menu.name || '';
    document.getElementById('menu-name-ar').value = menu.nameAr || '';
    document.getElementById('menu-description').value = menu.description || '';
    document.getElementById('menu-language').value = menu.language || 'en';
    document.getElementById('menu-rtl').checked = menu.rtl || false;
    document.getElementById('menu-show-prices').checked = menu.settings?.showPrices !== false;
    document.getElementById('menu-enable-ar').checked = menu.settings?.enableAR !== false;
    document.getElementById('menu-ar-mode').value = menu.settings?.arMode || 'markerless';
    elements.menuRestaurantSelect.value = menu.restaurant?._id || '';
  }
  
  openModal(elements.menuModal);
}

/**
 * Fill the dish "Category" select from the categories that actually exist on
 * the chosen menu. The markup used to ship a hard-coded list
 * (appetizer/main/dessert/drink/special) which never matched a restaurant's own
 * categories, so a saved dish ended up in a category the customer page could
 * not render.
 */
function populateDishCategories(menuId, selected) {
  const select = document.getElementById('dish-category');
  if (!select) return;

  const menu = state.menus.find(m => m._id === menuId);
  const categories = menu?.categories || [];

  if (!categories.length) {
    select.innerHTML = '<option value="">No categories on this menu yet</option>';
    return;
  }

  select.innerHTML = categories
    .slice()
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .map(c => {
      const label = c.nameAr ? `${c.name} — ${c.nameAr}` : c.name;
      return `<option value="${c.name}">${label}</option>`;
    })
    .join('');

  // Keep the dish's current category even if it is no longer in the list.
  if (selected) {
    if (![...select.options].some(o => o.value === selected)) {
      select.insertAdjacentHTML('afterbegin', `<option value="${selected}">${selected} (not in menu)</option>`);
    }
    select.value = selected;
  }
}

function openDishModal(dish = null) {
  state.editingType = 'dish';
  state.editingId = dish?._id || null;

  elements.dishModalTitle.textContent = dish ? 'Edit Dish' : 'Add Dish';
  elements.dishForm.reset();
  elements.dishId.value = dish?._id || '';
  elements.dishMenuId.value = dish?.menu?._id || '';

  // Keep the menu select in sync, then fill the category list from that menu.
  const activeMenuId = dish?.menu?._id || elements.dishMenuSelect.value || state.menus[0]?._id || '';
  if (activeMenuId) elements.dishMenuSelect.value = activeMenuId;
  populateDishCategories(activeMenuId, dish?.category);
  elements.dishMenuSelect.onchange = () =>
    populateDishCategories(elements.dishMenuSelect.value);
  
  if (dish) {
    document.getElementById('dish-name').value = dish.name || '';
    document.getElementById('dish-name-ar').value = dish.nameAr || '';
    document.getElementById('dish-price').value = dish.price || '';
    document.getElementById('dish-currency').value = dish.currency || 'DZD';
    document.getElementById('dish-description').value = dish.description || '';
    document.getElementById('dish-description-ar').value = dish.descriptionAr || '';
    document.getElementById('dish-display-order').value = dish.displayOrder || 0;
    document.getElementById('dish-featured').checked = dish.isFeatured || false;
    document.getElementById('dish-available').checked = dish.isAvailable !== false;
    
    // 3D Model
    if (dish.model3D) {
      document.getElementById('dish-scale-x').value = dish.model3D.scale?.x || 1;
      document.getElementById('dish-scale-y').value = dish.model3D.scale?.y || 1;
      document.getElementById('dish-scale-z').value = dish.model3D.scale?.z || 1;
      document.getElementById('dish-pos-x').value = dish.model3D.position?.x || 0;
      document.getElementById('dish-pos-y').value = dish.model3D.position?.y || 0;
      document.getElementById('dish-pos-z').value = dish.model3D.position?.z || 0;
      document.getElementById('dish-rot-x').value = dish.model3D.rotation?.x || 0;
      document.getElementById('dish-rot-y').value = dish.model3D.rotation?.y || 0;
      document.getElementById('dish-rot-z').value = dish.model3D.rotation?.z || 0;
      document.getElementById('dish-animation').value = dish.model3D.animation || 'rotate';
    }
    
    // AR Config
    if (dish.arConfig) {
      document.getElementById('dish-marker-type').value = dish.arConfig.markerType || 'surface';
      document.getElementById('dish-surface-detection').checked = dish.arConfig.surfaceDetection !== false;
      document.getElementById('dish-anchor-table').checked = dish.arConfig.anchorToTable !== false;
      document.getElementById('dish-allow-scale').checked = dish.arConfig.allowScale !== false;
      document.getElementById('dish-allow-rotation').checked = dish.arConfig.allowRotation !== false;
    }
    
    // Nutrition
    if (dish.nutrition) {
      document.getElementById('dish-calories').value = dish.nutrition.calories || '';
      document.getElementById('dish-protein').value = dish.nutrition.protein || '';
      document.getElementById('dish-carbs').value = dish.nutrition.carbs || '';
      document.getElementById('dish-fat').value = dish.nutrition.fat || '';
      document.getElementById('dish-allergens').value = dish.nutrition.allergens?.join(', ') || '';
      document.getElementById('dish-dietary').value = dish.nutrition.dietary?.join(', ') || '';
    }
    
    elements.dishMenuSelect.value = dish.menu?._id || '';
  }
  
  openModal(elements.dishModal);
}

function openModelUploadModal() {
  elements.modelUploadForm.reset();
  openModal(elements.modelUploadModal);
}

function closeAllModals() {
  document.querySelectorAll('.modal:not(.hidden)').forEach(modal => closeModal(modal));
  state.editingId = null;
  state.editingType = null;
}

// ============================================
// FORM HANDLING
// ============================================
async function handleRestaurantSubmit(e) {
  e.preventDefault();
  
  const formData = {
    name: document.getElementById('restaurant-name').value,
    nameAr: document.getElementById('restaurant-name-ar').value,
    slug: document.getElementById('restaurant-slug').value,
    phone: document.getElementById('restaurant-phone').value,
    email: document.getElementById('restaurant-email').value,
    address: document.getElementById('restaurant-address').value,
    description: document.getElementById('restaurant-description').value,
    primaryColor: document.getElementById('restaurant-primary-color').value,
    accentColor: document.getElementById('restaurant-accent-color').value,
    isPublished: document.getElementById('restaurant-published').checked
  };
  
  // Handle logo upload
  const logoFile = document.getElementById('restaurant-logo').files[0];
  if (logoFile) {
    const uploadData = new FormData();
    uploadData.append('image', logoFile);
    try {
      // The API responds with { success, file: { url, path, ... } } — the old
      // code read `result.image.url`, which was always undefined.
      const result = await uploadFile('/image', uploadData);
      formData.logo = result.file?.url || result.image?.url;
    } catch (error) {
      showToast(`Failed to upload logo: ${error.message}`, 'error');
      return; // don't save a restaurant with a silently missing logo
    }

  }
  
  try {
    if (state.editingId) {
      await apiRequest(`/admin/restaurant/${state.editingId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      showToast('Restaurant updated successfully', 'success');
    } else {
      await apiRequest('/admin/restaurant', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      showToast('Restaurant created successfully', 'success');
    }
    
    closeModal(elements.restaurantModal);
    await fetchRestaurants();
    renderRestaurantsTable();
    updateDashboardStats();
    populateRestaurantSelects();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleMenuSubmit(e) {
  e.preventDefault();
  
  const formData = {
    restaurant: elements.menuRestaurantSelect.value,
    name: document.getElementById('menu-name').value,
    nameAr: document.getElementById('menu-name-ar').value,
    description: document.getElementById('menu-description').value,
    language: document.getElementById('menu-language').value,
    rtl: document.getElementById('menu-rtl').checked,
    settings: {
      showPrices: document.getElementById('menu-show-prices').checked,
      enableAR: document.getElementById('menu-enable-ar').checked,
      arMode: document.getElementById('menu-ar-mode').value
    }
  };
  
  try {
    if (state.editingId) {
      await apiRequest(`/admin/menu/${state.editingId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      showToast('Menu updated successfully', 'success');
    } else {
      await apiRequest('/admin/menu', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      showToast('Menu created successfully', 'success');
    }
    
    closeModal(elements.menuModal);
    await fetchMenus();
    renderMenusTable();
    updateDashboardStats();
    populateMenuSelects();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleDishSubmit(e) {
  e.preventDefault();
  
  const menuId = elements.dishMenuSelect.value;
  if (!menuId) {
    showToast('Please select a menu', 'error');
    return;
  }

  const chosenCategory = document.getElementById('dish-category').value;
  if (!chosenCategory) {
    showToast('Please choose a category for this dish', 'error');
    return;
  }

  // Guard against double submits — a second click used to create a duplicate
  // dish because the request is asynchronous and the button stayed live.
  if (state.savingDish) return;
  state.savingDish = true;
  const submitBtn = elements.dishForm.querySelector('button[type="submit"]');
  const submitLabel = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
  }

  const formData = {
    name: document.getElementById('dish-name').value,
    nameAr: document.getElementById('dish-name-ar').value,
    price: parseFloat(document.getElementById('dish-price').value),
    currency: document.getElementById('dish-currency').value,
    description: document.getElementById('dish-description').value,
    descriptionAr: document.getElementById('dish-description-ar').value,
    category: document.getElementById('dish-category').value,
    displayOrder: parseInt(document.getElementById('dish-display-order').value) || 0,
    isFeatured: document.getElementById('dish-featured').checked,
    isAvailable: document.getElementById('dish-available').checked,
    model3D: {
      scale: {
        x: parseFloat(document.getElementById('dish-scale-x').value) || 1,
        y: parseFloat(document.getElementById('dish-scale-y').value) || 1,
        z: parseFloat(document.getElementById('dish-scale-z').value) || 1
      },
      position: {
        x: parseFloat(document.getElementById('dish-pos-x').value) || 0,
        y: parseFloat(document.getElementById('dish-pos-y').value) || 0,
        z: parseFloat(document.getElementById('dish-pos-z').value) || 0
      },
      rotation: {
        x: parseFloat(document.getElementById('dish-rot-x').value) || 0,
        y: parseFloat(document.getElementById('dish-rot-y').value) || 0,
        z: parseFloat(document.getElementById('dish-rot-z').value) || 0
      },
      animation: document.getElementById('dish-animation').value
    },
    arConfig: {
      markerType: document.getElementById('dish-marker-type').value,
      surfaceDetection: document.getElementById('dish-surface-detection').checked,
      anchorToTable: document.getElementById('dish-anchor-table').checked,
      allowScale: document.getElementById('dish-allow-scale').checked,
      allowRotation: document.getElementById('dish-allow-rotation').checked
    },
    nutrition: {
      calories: parseInt(document.getElementById('dish-calories').value) || undefined,
      protein: parseFloat(document.getElementById('dish-protein').value) || undefined,
      carbs: parseFloat(document.getElementById('dish-carbs').value) || undefined,
      fat: parseFloat(document.getElementById('dish-fat').value) || undefined,
      allergens: document.getElementById('dish-allergens').value.split(',').map(s => s.trim()).filter(Boolean),
      dietary: document.getElementById('dish-dietary').value.split(',').map(s => s.trim()).filter(Boolean)
    }
  };
  
  // Keep assets the form does not represent. model3D/arConfig are rebuilt from
  // scratch above, so editing a dish without re-picking files used to wipe its
  // photo (model3d.thumbnail), its GLB url and its marker image.
  if (state.editingId) {
    const existing = state.dishes.find(d => d._id === state.editingId);
    if (existing) {
      formData.model3D = { ...(existing.model3D || {}), ...formData.model3D };
      formData.arConfig = { ...(existing.arConfig || {}), ...formData.arConfig };
    }
  }

  // Handle model file upload
  const modelFile = document.getElementById('dish-model-file').files[0];
  const thumbnailFile = document.getElementById('dish-thumbnail').files[0];
  const markerFile = document.getElementById('dish-marker-image').files[0];
  
  if (modelFile || thumbnailFile || markerFile) {
    const uploadData = new FormData();
    if (modelFile) uploadData.append('model', modelFile);
    if (thumbnailFile) uploadData.append('thumbnail', thumbnailFile);
    if (markerFile) uploadData.append('image', markerFile);
    
    try {
      const result = await uploadFile('/model-set', uploadData);
      if (result.files.model) formData.model3D.url = result.files.model.url;
      if (result.files.thumbnail) formData.model3D.thumbnail = result.files.thumbnail.url;
      if (result.files.image) formData.arConfig.markerImage = result.files.image.url;
    } catch (error) {
      // Abort instead of saving a dish whose files silently went missing.
      showToast(`Failed to upload files: ${error.message}`, 'error');
      state.savingDish = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      }
      return;
    }
  }
  
  try {
    if (state.editingId) {
      await apiRequest(`/admin/menu/${menuId}/dishes/${state.editingId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      showToast('Dish updated successfully', 'success');
    } else {
      await apiRequest(`/admin/menu/${menuId}/dishes`, {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      showToast('Dish created successfully', 'success');
    }
    
    closeModal(elements.dishModal);
    await fetchDishes();
    renderDishesTable();
    updateDashboardStats();
    renderModelsGrid();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    state.savingDish = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
    }
  }
}

async function handleModelUpload(e) {
  e.preventDefault();
  
  const modelFile = document.getElementById('model-file').files[0];
  const thumbnailFile = document.getElementById('model-thumbnail').files[0];
  const dishId = document.getElementById('model-dish').value;
  
  if (!modelFile) {
    showToast('Please select a model file', 'error');
    return;
  }
  
  const uploadData = new FormData();
  uploadData.append('model', modelFile);
  if (thumbnailFile) uploadData.append('thumbnail', thumbnailFile);
  
  try {
    const result = await uploadFile('/model-set', uploadData);
    showToast('Model uploaded successfully', 'success');
    
    // If dish selected, update dish with model
    if (dishId && result.files.model) {
      const dish = state.dishes.find(d => d._id === dishId);
      if (dish) {
        await apiRequest(`/admin/menu/${dish.menu._id}/dishes/${dishId}`, {
          method: 'PUT',
          body: JSON.stringify({
            model3D: {
              url: result.files.model.url,
              thumbnail: result.files.thumbnail?.url || '',
              scale: { x: 1, y: 1, z: 1 },
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              animation: 'rotate'
            }
          })
        });
        showToast('Dish updated with new model', 'success');
      }
    }
    
    closeModal(elements.modelUploadModal);
    await fetchDishes();
    renderModelsGrid();
    updateDashboardStats();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ============================================
// DELETE HANDLING
// ============================================
async function handleDelete(type, id) {
  if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
  
  try {
    let endpoint;
    switch (type) {
      case 'restaurant':
        endpoint = `/admin/restaurant/${id}`;
        break;
      case 'menu':
        endpoint = `/admin/menu/${id}`;
        break;
      case 'dish':
        const dish = state.dishes.find(d => d._id === id);
        if (!dish) throw new Error('Dish not found');
        endpoint = `/admin/menu/${dish.menu._id}/dishes/${id}`;
        break;
      default:
        throw new Error('Unknown type');
    }
    
    await apiRequest(endpoint, { method: 'DELETE' });
    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`, 'success');
    
    // Refresh data
    switch (type) {
      case 'restaurant':
        await fetchRestaurants();
        renderRestaurantsTable();
        populateRestaurantSelects();
        break;
      case 'menu':
        await fetchMenus();
        renderMenusTable();
        populateMenuSelects();
        break;
      case 'dish':
        await fetchDishes();
        renderDishesTable();
        renderModelsGrid();
        break;
    }
    updateDashboardStats();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ============================================
// TABLE ACTION LISTENERS
// ============================================
function attachTableActionListeners(type) {
  // Edit buttons
  document.querySelectorAll(`.edit-btn[data-type="${type}"]`).forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      let item;
      switch (type) {
        case 'restaurant':
          item = state.restaurants.find(r => r._id === id);
          openRestaurantModal(item);
          break;
        case 'menu':
          item = state.menus.find(m => m._id === id);
          openMenuModal(item);
          break;
        case 'dish':
          item = state.dishes.find(d => d._id === id);
          openDishModal(item);
          break;
      }
    });
  });
  
  // Delete buttons
  document.querySelectorAll(`.delete-btn[data-type="${type}"]`).forEach(btn => {
    btn.addEventListener('click', () => {
      handleDelete(type, btn.dataset.id);
    });
  });
}

// ============================================
// FILTER HANDLING
// ============================================
function setupFilters() {
  elements.filterRestaurant?.addEventListener('change', async () => {
    const restaurantId = elements.filterRestaurant.value;
    const category = elements.filterCategory.value;
    await fetchDishes({ restaurantId, category });
    renderDishesTable();
  });
  
  elements.filterCategory?.addEventListener('change', async () => {
    const restaurantId = elements.filterRestaurant.value;
    const category = elements.filterCategory.value;
    await fetchDishes({ restaurantId, category });
    renderDishesTable();
  });
  
  elements.analyticsMenu?.addEventListener('change', async () => {
    const menuId = elements.analyticsMenu.value;
    const period = elements.analyticsPeriod.value;
    const data = await fetchAnalytics(menuId, period);
    renderAnalytics(data);
  });
  
  elements.analyticsPeriod?.addEventListener('change', async () => {
    const menuId = elements.analyticsMenu.value;
    const period = elements.analyticsPeriod.value;
    const data = await fetchAnalytics(menuId, period);
    renderAnalytics(data);
  });
}

// ============================================
// NAVIGATION
// ============================================
function navigateTo(page) {
  // Update nav links
  elements.navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });
  
  // Update pages
  elements.pages.forEach(pageEl => {
    pageEl.classList.toggle('hidden', pageEl.dataset.page !== page);
  });
  
  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    restaurants: 'Restaurants',
    menus: 'Menus',
    dishes: 'Dishes',
    models: '3D Models',
    analytics: 'Analytics',
    settings: 'Settings'
  };
  elements.pageTitle.textContent = titles[page] || 'Dashboard';
  
  state.currentPage = page;
  
  // Close mobile sidebar
  elements.sidebar.classList.remove('open');
  elements.mainContent.classList.remove('sidebar-open');
  
  // Load page-specific data
  if (page === 'analytics' && !state.analytics) {
    fetchAnalytics().then(renderAnalytics);
  }
}

function setupNavigation() {
  elements.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });
  
  // Quick action buttons
  elements.actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      switch (action) {
        case 'create-restaurant':
          openRestaurantModal();
          break;
        case 'create-menu':
          openMenuModal();
          break;
        case 'upload-model':
          openModelUploadModal();
          break;
        case 'view-analytics':
          navigateTo('analytics');
          break;
      }
    });
  });
  
  // Add buttons
  elements.btnAddRestaurant?.addEventListener('click', () => openRestaurantModal());
  elements.btnAddMenu?.addEventListener('click', () => openMenuModal());
  elements.btnAddDish?.addEventListener('click', () => openDishModal());
  elements.btnUploadModel?.addEventListener('click', () => openModelUploadModal());
  elements.btnUploadModel2?.addEventListener('click', () => openModelUploadModal());
}

// ============================================
// SIDEBAR & UI TOGGLES
// ============================================
function setupSidebar() {
  // Sidebar toggle (desktop)
  elements.sidebarToggle?.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    elements.sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
    elements.mainContent.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
  });
  
  // Mobile menu button
  elements.mobileMenuBtn?.addEventListener('click', () => {
    elements.sidebar.classList.toggle('open');
    elements.mainContent.classList.toggle('sidebar-open');
  });
  
  // Close sidebar on backdrop click (mobile)
  elements.mainContent?.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024 && elements.sidebar.classList.contains('open')) {
      if (!elements.sidebar.contains(e.target) && !elements.mobileMenuBtn.contains(e.target)) {
        elements.sidebar.classList.remove('open');
        elements.mainContent.classList.remove('sidebar-open');
      }
    }
  });
}

function setupUserMenu() {
  elements.userMenuTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.userMenuOpen = !state.userMenuOpen;
    elements.userDropdown.classList.toggle('open', state.userMenuOpen);
  });
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (state.userMenuOpen && !elements.userMenu.contains(e.target)) {
      state.userMenuOpen = false;
      elements.userDropdown.classList.remove('open');
    }
  });
  
  // Logout buttons
  elements.btnLogout?.addEventListener('click', handleLogout);
  elements.dropdownLogout?.addEventListener('click', handleLogout);
}

function handleLogout() {
  showToast('Logging out...', 'info');
  // In a real app, this would call an auth logout endpoint
  setTimeout(() => {
    window.location.href = '/login';
  }, 1000);
}

// ============================================
// SETTINGS FORMS
// ============================================
function setupSettingsForms() {
  document.getElementById('general-settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('General settings saved', 'success');
  });
  
  document.getElementById('ar-settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('AR settings saved', 'success');
  });
  
  document.getElementById('api-settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('API settings saved', 'success');
  });
}

// ============================================
// MODAL EVENT LISTENERS
// ============================================
function setupModalListeners() {
  // Form submissions
  elements.restaurantForm?.addEventListener('submit', handleRestaurantSubmit);
  elements.menuForm?.addEventListener('submit', handleMenuSubmit);
  elements.dishForm?.addEventListener('submit', handleDishSubmit);
  elements.modelUploadForm?.addEventListener('submit', handleModelUpload);
  
  // Close buttons
  elements.modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) closeModal(modal);
    });
  });
  
  // Backdrop clicks
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
      const modal = backdrop.closest('.modal');
      if (modal) closeModal(modal);
    });
  });
  
  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================
async function init() {
  initDOMElements();
  
  setupNavigation();
  setupSidebar();
  setupUserMenu();
  setupModalListeners();
  setupFilters();
  setupSettingsForms();

  // The admin API requires a key; ask before the first request so the user sees
  // one prompt instead of a wall of "Failed to load ..." toasts.
  if (!getAdminKey()) {
    promptAdminKey('Admin key required.\n\nPaste the ADMIN_API_KEY for طلباتي:');
  }

  // Load initial data
  showToast('Loading dashboard...', 'info');

  await fetchAllData();
  
  // Load analytics for dashboard
  const analyticsData = await fetchAnalytics();
  if (analyticsData) {
    renderAnalytics(analyticsData);
  }
  
  showToast('Dashboard loaded', 'success');
  
  console.log('Admin panel initialized');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.AdminPanel = {
  state,
  showToast,
  navigateTo,
  openRestaurantModal,
  openMenuModal,
  openDishModal,
  openModelUploadModal
};