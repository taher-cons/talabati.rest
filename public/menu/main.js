/**
 * WebAR Menu - Traditional Menu View
 * Handles menu display, dish details, ordering, and AR mode switching
 */

import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';
import ScrollTrigger from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger/+esm';

gsap.registerPlugin(ScrollTrigger);

// ============================================
// CONFIGURATION & STATE
// ============================================
const CONFIG = {
  apiBase: '/api/menu',
  animationStagger: 80,
  carouselAutoPlay: 5000,
  // Pilot restaurant. Used when the URL carries no slug (i.e. a bare `/menu`),
  // which previously resolved the slug to the literal string "menu" and made the
  // API answer 500.
  defaultRestaurantSlug: 'firasse_food'
};

/**
 * Resolve the restaurant slug from, in order of precedence:
 *   1. `/menu/<slug>` path segment
 *   2. `?r=<slug>` / `?restaurant=<slug>` query string
 *   3. CONFIG.defaultRestaurantSlug (pilot fallback)
 */
function resolveRestaurantSlug() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('r') || params.get('restaurant');

  const segments = window.location.pathname.split('/').filter(Boolean);
  const menuIndex = segments.indexOf('menu');
  const fromPath = menuIndex !== -1 ? segments[menuIndex + 1] : segments[segments.length - 1];

  const candidate = fromPath && fromPath !== 'menu' ? fromPath : fromQuery;
  return candidate || CONFIG.defaultRestaurantSlug;
}

const state = {
  restaurantSlug: null,
  restaurantData: null,
  menuData: null,
  dishesByCategory: {},
  currentCategory: null,
  featuredDishes: [],
  language: 'en',
  order: [],
  isOrderSidebarOpen: false
};

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {};

function initDOMElements() {
  elements.loadingScreen = document.getElementById('loading-screen');
  elements.loadingBar = document.getElementById('loading-bar');
  elements.app = document.getElementById('app');
  elements.header = document.getElementById('header');
  elements.restaurantLogo = document.getElementById('restaurant-logo');
  elements.restaurantName = document.getElementById('restaurant-name');
  elements.restaurantTagline = document.getElementById('restaurant-tagline');
  elements.categoryScroll = document.getElementById('category-scroll');
  elements.heroSection = document.getElementById('hero-section');
  elements.carouselTrack = document.getElementById('carousel-track');
  elements.carouselPrev = document.getElementById('carousel-prev');
  elements.carouselNext = document.getElementById('carousel-next');
  elements.menuSections = document.getElementById('menu-sections');
  elements.footerLogo = document.getElementById('footer-logo');
  elements.footerName = document.getElementById('footer-name');
  elements.footerAddress = document.getElementById('footer-address');
  elements.footerSocial = document.getElementById('footer-social');
  elements.footerCopyright = document.getElementById('footer-copyright');
  elements.linkWebsite = document.getElementById('link-website');
  elements.linkPhone = document.getElementById('link-phone');
  elements.linkEmail = document.getElementById('link-email');
  
  // Modal
  elements.dishModal = document.getElementById('dish-modal');
  elements.modalClose = document.getElementById('modal-close');
  elements.modalImg = document.getElementById('modal-img');
  elements.modalBadges = document.getElementById('modal-badges');
  elements.modalTitle = document.getElementById('modal-title');
  elements.modalDescription = document.getElementById('modal-description');
  elements.modalPrice = document.getElementById('modal-price');
  elements.modalCategory = document.getElementById('modal-category');
  elements.modalNutrition = document.getElementById('modal-nutrition');
  elements.modalNutritionGrid = document.getElementById('modal-nutrition-grid');
  elements.modalAllergens = document.getElementById('modal-allergens');
  elements.modalAllergenTags = document.getElementById('modal-allergen-tags');
  elements.modalDietary = document.getElementById('modal-dietary');
  elements.modalDietaryTags = document.getElementById('modal-dietary-tags');
  elements.modalArBtn = document.getElementById('modal-ar-btn');
  elements.modalOrderBtn = document.getElementById('modal-order-btn');
  
  // Order Sidebar
  elements.orderSidebar = document.getElementById('order-sidebar');
  elements.closeOrder = document.getElementById('close-order');
  elements.orderItems = document.getElementById('order-items');
  elements.orderSummary = document.getElementById('order-summary');
  elements.orderSubtotal = document.getElementById('order-subtotal');
  elements.orderTax = document.getElementById('order-tax');
  elements.orderTotal = document.getElementById('order-total');
  elements.btnCheckout = document.getElementById('btn-checkout');
  
  // Order Toggle (Mobile)
  elements.orderToggle = document.getElementById('btn-order-toggle');
  elements.orderCount = document.getElementById('order-count');
  elements.orderTotalText = document.getElementById('order-total-text');
  
  // Buttons
  elements.btnArMode = document.getElementById('btn-ar-mode');
  elements.btnLanguage = document.getElementById('btn-language');
  
  // Toast
  elements.toastContainer = document.getElementById('toast-container');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showLoading(percent) {
  if (elements.loadingBar) {
    elements.loadingBar.style.width = `${percent}%`;
  }
}

function hideLoading() {
  if (elements.loadingScreen) {
    gsap.to(elements.loadingScreen, {
      opacity: 0,
      duration: 0.5,
      onComplete: () => {
        elements.loadingScreen.style.display = 'none';
        elements.app.hidden = false;
        gsap.fromTo(elements.app, 
          { opacity: 0 },
          { opacity: 1, duration: 0.5 }
        );
        animatePageEntrance();
      }
    });
  }
}

function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success' ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' : 
       type === 'error' ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' :
       '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>' }
    </svg>
    <span>${message}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  gsap.fromTo(toast, 
    { opacity: 0, x: 300 },
    { opacity: 1, x: 0, duration: 0.4, ease: 'back.out(1.7)' }
  );
  
  setTimeout(() => {
    gsap.to(toast, {
      opacity: 0,
      x: 300,
      duration: 0.3,
      onComplete: () => toast.remove()
    });
  }, duration);
}

// Inline placeholder keeps the layout intact when a dish has no 2D thumbnail yet
// (e.g. the 3D asset was uploaded before the image). Avoids the browser's broken
// image icon that was visible on the pilot build.
const IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%231A1A1F'/%3E%3Cpath d='M200 120a30 30 0 100 60 30 30 0 000-60zm0 10a20 20 0 110 40 20 20 0 010-40z' fill='%23C5A059' opacity='.5'/%3E%3C/svg%3E";

function dishImage(dish) {
  return dish?.model3D?.thumbnail || dish?.image || dish?.imageUrl || IMAGE_PLACEHOLDER;
}

/**
 * True only when the dish really has a 3D model to show in AR.
 * Without this check every dish advertised an AR experience and the customer
 * landed on a camera view holding an empty placeholder plate.
 */
function hasArModel(dish) {
  return Boolean(dish?.model3D?.url);
}

/** Small "3D" ribbon so customers can tell which dishes are worth tapping. */
function arBadge(dish) {
  if (!hasArModel(dish)) return '';
  const label = state.language === 'ar' ? 'مجسّم ثلاثي الأبعاد' : '3D View';
  return `<span class="badge badge-ar" title="${label}">🧊 ${label}</span>`;
}

function formatPrice(price, currency = 'DZD') {
  const amount = Number(price) || 0;
  try {
    return new Intl.NumberFormat('ar-DZ', {
      style: 'currency',
      currency: currency || 'DZD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (_) {
    // Unknown/invalid ISO currency code must never break rendering.
    return `${amount.toLocaleString('ar-DZ')} ${currency || ''}`.trim();
  }
}

function getText(obj, field, fallback = '') {
  const langField = state.language !== 'en' ? `${field}${state.language.charAt(0).toUpperCase() + state.language.slice(1)}` : field;
  return obj[langField] || obj[field] || fallback;
}

// GSAP logs "target not found" warnings when a selector matches nothing, which
// happened on every load because the menu sections are built after this runs.
// Animating only what exists keeps the console clean.
function animateIfPresent(target, from, to) {
  const nodes = typeof target === 'string' ? document.querySelectorAll(target) : target;
  const hasNodes = target instanceof Element ? Boolean(target) : nodes && nodes.length > 0;
  if (!hasNodes) return;
  gsap.fromTo(target, from, to);
}

function animatePageEntrance() {
  // Animate header
  animateIfPresent(elements.header,
    { y: -100, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }
  );
  
  // Animate hero
  animateIfPresent(elements.heroSection,
    { y: 30, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out', delay: 0.1 }
  );
  
  // Animate menu sections
  animateIfPresent('.menu-category',
    { y: 30, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.1, delay: 0.2 }
  );
  
  // Animate footer
  animateIfPresent('#footer',
    { y: 30, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.4 }
  );
}

// ============================================
// API FUNCTIONS
// ============================================
async function fetchRestaurantData() {
  showLoading(10);
  
  try {
    state.restaurantSlug = resolveRestaurantSlug();

    // NOTE: the endpoint is `/restaurant/slug/:slug`. Calling `/restaurant/:id`
    // with a slug made Postgres reject the uuid cast and return HTTP 500.
    const response = await fetch(`${CONFIG.apiBase}/restaurant/slug/${encodeURIComponent(state.restaurantSlug)}`);
    if (!response.ok) {
      throw new Error(`Restaurant not found (${response.status}) for slug "${state.restaurantSlug}"`);
    }
    
    state.restaurantData = await response.json();
    showLoading(30);
    return state.restaurantData;
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    showToast('Failed to load restaurant', 'error');
    throw error;
  }
}

async function fetchMenuData() {
  showLoading(40);
  
  try {
    // The restaurant's active menu, keyed by restaurant id (uuid).
    const restaurantId = state.restaurantData?._id || state.restaurantData?.id;
    const response = await fetch(`${CONFIG.apiBase}/restaurant/${restaurantId}`);
    if (!response.ok) {
      throw new Error(`Menu not found (${response.status}) for restaurant ${restaurantId}`);
    }
    
    state.menuData = await response.json();

    // Defensive defaults: a menu with no categories/dishes must render an empty
    // state, never throw.
    state.menuData.dishes = state.menuData.dishes || [];
    state.menuData.categories = state.menuData.categories || [];

    // Derive categories from the dishes themselves when the menu has no explicit
    // category rows yet - otherwise freshly added dishes stay invisible.
    if (state.menuData.categories.length === 0 && state.menuData.dishes.length > 0) {
      const derived = [...new Set(state.menuData.dishes.map(d => d.category).filter(Boolean))];
      state.menuData.categories = derived.map((name, index) => ({
        name,
        nameAr: name,
        isActive: true,
        displayOrder: index
      }));
    }
    
    // Organize dishes by category
    state.menuData.dishes.forEach(dish => {
      if (!state.dishesByCategory[dish.category]) {
        state.dishesByCategory[dish.category] = [];
      }
      // `isAvailable` may legitimately be undefined on older rows; only an
      // explicit `false` should hide a dish.
      if (dish.isAvailable !== false) {
        state.dishesByCategory[dish.category].push(dish);
      }
    });
    
    // Sort dishes by displayOrder
    Object.keys(state.dishesByCategory).forEach(cat => {
      state.dishesByCategory[cat].sort((a, b) => a.displayOrder - b.displayOrder);
    });
    
    // Get featured dishes
    state.featuredDishes = state.menuData.dishes
      .filter(d => d.isFeatured && d.isAvailable !== false)
      .sort((a, b) => b.displayOrder - a.displayOrder);
    
    showLoading(70);
    return state.menuData;
  } catch (error) {
    console.error('Error fetching menu:', error);
    showToast('Failed to load menu', 'error');
    throw error;
  }
}

// ============================================
// UI BUILDING FUNCTIONS
// ============================================
function updateRestaurantBranding() {
  if (!state.restaurantData) return;
  
  // Header — fall back to the app icon so no broken image is ever rendered.
  const logo = state.restaurantData.logo || '/favicon-32x32.png';
  elements.restaurantLogo.src = logo;
  elements.restaurantName.textContent = getText(state.restaurantData, 'name');
  elements.restaurantTagline.textContent = getText(state.restaurantData, 'description', 'Fine Dining Experience');
  
  // Footer
  elements.footerLogo.src = logo;
  elements.footerName.textContent = getText(state.restaurantData, 'name');
  elements.footerAddress.textContent = state.restaurantData.address || '123 Culinary Street, Food City';
  
  // Social links
  if (state.restaurantData.socialLinks) {
    elements.footerSocial.innerHTML = '';
    Object.entries(state.restaurantData.socialLinks).forEach(([platform, url]) => {
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'social-link';
        link.setAttribute('aria-label', platform);
        link.innerHTML = getSocialIcon(platform);
        elements.footerSocial.appendChild(link);
      }
    });
  }
  
  // Footer links
  if (state.restaurantData.website) {
    elements.linkWebsite.href = state.restaurantData.website;
  }
  if (state.restaurantData.phone) {
    elements.linkPhone.href = `tel:${state.restaurantData.phone}`;
  }
  if (state.restaurantData.email) {
    elements.linkEmail.href = `mailto:${state.restaurantData.email}`;
  }
  
  // Copyright
  elements.footerCopyright.textContent = `© ${new Date().getFullYear()} ${getText(state.restaurantData, 'name')}. All rights reserved.`;
  
  // Apply colors
  document.documentElement.style.setProperty('--primary-color', state.restaurantData.primaryColor || '#1a1a2e');
  document.documentElement.style.setProperty('--accent-color', state.restaurantData.accentColor || '#e94560');
}

function getSocialIcon(platform) {
  const icons = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 8.5c0 2.5-2 4.5-4.5 4.5S6 11 6 8.5s2-4.5 4.5-4.5S15 6 15 8.5Z"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M2.5 12h2"/><path d="M19.5 12h2"/><path d="M18.9 3.1a10 10 0 0 1 2.5 12.5"/><path d="M5.5 3.1a10 10 0 0 0 2.5 12.5"/></svg>'
  };
  return icons[platform] || icons.instagram;
}

function buildCategoryNavigation() {
  if (!state.menuData) return;
  
  elements.categoryScroll.innerHTML = '';
  
  // Add "All" button
  const allBtn = document.createElement('button');
  allBtn.className = 'category-btn active';
  allBtn.dataset.category = 'all';
  allBtn.innerHTML = `<span class="category-name">All</span>`;
  allBtn.addEventListener('click', () => selectCategory('all', allBtn));
  elements.categoryScroll.appendChild(allBtn);
  
  state.menuData.categories.forEach((category, index) => {
    if (!category.isActive) return;
    
    const btn = document.createElement('button');
    btn.className = 'category-btn';
    btn.dataset.category = category.name;
    btn.innerHTML = `
      ${category.icon ? `<span class="category-icon">${category.icon}</span>` : ''}
      <span class="category-name">${getText(category, 'name')}</span>
      <span class="category-count">${state.dishesByCategory[category.name]?.length || 0}</span>
    `;
    
    btn.addEventListener('click', () => selectCategory(category.name, btn));
    elements.categoryScroll.appendChild(btn);
  });
  
  // Select first category (All)
  selectCategory('all');
}

function selectCategory(categoryName, btnElement = null) {
  state.currentCategory = categoryName;
  
  // Update button states
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === categoryName);
  });
  
  // Build menu sections
  buildMenuSections(categoryName);
  
  // Scroll to top of menu sections
  elements.menuSections.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildMenuSections(categoryFilter = 'all') {
  if (!state.menuData) return;
  
  elements.menuSections.innerHTML = '';
  
  const categoriesToShow = categoryFilter === 'all' 
    ? state.menuData.categories.filter(c => c.isActive)
    : state.menuData.categories.filter(c => c.isActive && c.name === categoryFilter);
  
  categoriesToShow.forEach((category, catIndex) => {
    const dishes = state.dishesByCategory[category.name] || [];
    
    if (dishes.length === 0) return;
    
    const section = document.createElement('section');
    section.className = 'menu-category';
    section.style.animationDelay = `${catIndex * 100}ms`;
    section.dataset.category = category.name;
    
    section.innerHTML = `
      <div class="category-header">
        <div class="category-title">
          ${category.icon ? `<span class="category-icon">${category.icon}</span>` : ''}
          <h2 class="category-name">${getText(category, 'name')}</h2>
        </div>
        ${category.description ? `<p class="category-description">${getText(category, 'description')}</p>` : ''}
      </div>
      <div class="dishes-grid" id="dishes-${category.name}"></div>
    `;
    
    elements.menuSections.appendChild(section);
    
    // Build dishes for this category
    const grid = section.querySelector('.dishes-grid');
    buildDishesGrid(grid, dishes, catIndex);
  });
  
  // If no categories have dishes
  if (elements.menuSections.children.length === 0) {
    elements.menuSections.innerHTML = `
      <div class="no-dishes" style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 64px; height: 64px; margin: 0 auto 16px; opacity: 0.5;">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <h3 style="font-size: 1.25rem; margin-bottom: 8px;">No dishes available</h3>
        <p>Check back later for our delicious offerings!</p>
      </div>
    `;
  }
}

function buildDishesGrid(grid, dishes, catIndex) {
  dishes.forEach((dish, dishIndex) => {
    const card = document.createElement('article');
    card.className = 'dish-card';
    card.dataset.dishId = dish._id;
    card.style.animationDelay = `${catIndex * 100 + dishIndex * CONFIG.animationStagger}ms`;
    
    const badges = [];
    if (dish.isFeatured) badges.push('featured');
    if (dish.nutrition?.dietary?.includes('vegetarian')) badges.push('vegetarian');
    if (dish.nutrition?.dietary?.includes('vegan')) badges.push('vegan');
    if (dish.nutrition?.dietary?.includes('gluten-free')) badges.push('gluten-free');
    if (dish.nutrition?.dietary?.includes('spicy')) badges.push('spicy');
    
    card.innerHTML = `
      <div class="dish-image">
        <img src="${dishImage(dish)}" alt="${getText(dish, 'name')}" loading="lazy">
        <div class="dish-badges">
          ${arBadge(dish)}
          ${badges.map(b => `<span class="badge badge-${b}">${getBadgeLabel(b)}</span>`).join('')}
        </div>
      </div>
      <div class="dish-content">
        <div class="dish-header">
          <h3 class="dish-title">${getText(dish, 'name')}</h3>
          <span class="dish-price">${formatPrice(dish.price, dish.currency)}</span>
        </div>
        <p class="dish-description">${getText(dish, 'description', '')}</p>
        <div class="dish-meta">
          <span class="dish-tag">${categoryLabel(dish.category)}</span>
          ${dish.nutrition?.calories ? `<span class="dish-tag">${dish.nutrition.calories} cal</span>` : ''}
        </div>
        <div class="dish-actions">
          <button class="btn btn-primary btn-view-details" data-dish-id="${dish._id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
            Details
          </button>
          <button class="btn btn-accent btn-add-order" data-dish-id="${dish._id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            Add
          </button>
        </div>
      </div>
    `;
    
    // Event listeners
    card.querySelector('.btn-view-details').addEventListener('click', (e) => {
      e.stopPropagation();
      openDishModal(dish);
    });
    
    card.querySelector('.btn-add-order').addEventListener('click', (e) => {
      e.stopPropagation();
      addToOrder(dish, e);
    });
    
    // Click on card opens details
    card.addEventListener('click', () => openDishModal(dish));
    
    grid.appendChild(card);
  });
}

function getBadgeLabel(badge) {
  const labels = {
    featured: 'Featured',
    vegetarian: 'Vegetarian',
    vegan: 'Vegan',
    'gluten-free': 'Gluten-Free',
    spicy: 'Spicy'
  };
  return labels[badge] || badge;
}

function categoryLabel(category) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function buildFeaturedCarousel() {
  if (state.featuredDishes.length === 0) {
    elements.heroSection.style.display = 'none';
    return;
  }
  
  elements.carouselTrack.innerHTML = '';
  
  state.featuredDishes.forEach((dish, index) => {
    const card = document.createElement('article');
    card.className = 'dish-card featured-card';
    card.dataset.dishId = dish._id;
    card.style.minWidth = '280px';
    card.style.flexShrink = '0';
    card.style.scrollSnapAlign = 'start';
    
    card.innerHTML = `
      <div class="dish-image">
        <img src="${dishImage(dish)}" alt="${getText(dish, 'name')}" loading="lazy">
        <div class="dish-badges">
          ${arBadge(dish)}
          <span class="badge badge-featured">Featured</span>
        </div>
      </div>
      <div class="dish-content">
        <div class="dish-header">
          <h3 class="dish-title">${getText(dish, 'name')}</h3>
          <span class="dish-price">${formatPrice(dish.price, dish.currency)}</span>
        </div>
        <p class="dish-description">${getText(dish, 'description', '')}</p>
        <div class="dish-actions">
          <button class="btn btn-primary btn-view-details" data-dish-id="${dish._id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
            Details
          </button>
          <button class="btn btn-accent btn-add-order" data-dish-id="${dish._id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            Add
          </button>
        </div>
      </div>
    `;
    
    card.querySelector('.btn-view-details').addEventListener('click', (e) => {
      e.stopPropagation();
      openDishModal(dish);
    });
    
    card.querySelector('.btn-add-order').addEventListener('click', (e) => {
      e.stopPropagation();
      addToOrder(dish, e);
    });
    
    card.addEventListener('click', () => openDishModal(dish));
    
    elements.carouselTrack.appendChild(card);
  });
  
  // Setup carousel navigation
  setupCarousel();
}

function setupCarousel() {
  const track = elements.carouselTrack;
  const cards = track.querySelectorAll('.featured-card');
  
  if (cards.length <= 1) {
    elements.carouselPrev.style.display = 'none';
    elements.carouselNext.style.display = 'none';
    return;
  }
  
  /**
   * CAROUSEL: use the browser's own horizontal scrolling — nothing else.
   *
   * The bug: styles.css already makes `.carousel-track` a scroll container
   * (`overflow-x: auto` + `scroll-snap-type: x mandatory`), while this script
   * was ALSO moving it with `transform: translateX(...)`. The two mechanisms
   * fought each other and `.featured-carousel { overflow: hidden }` clipped the
   * result — which is why the section showed a big empty area with, at best, one
   * half-visible card. The RTL layout made it worse: `offsetLeft` differences go
   * negative in RTL, so the computed step flipped sign and pushed every card out
   * of view entirely.
   *
   * Native scrolling handles RTL, touch swiping, momentum and boundaries
   * correctly on every browser, so all of that hand-written maths is gone.
   */
  track.style.transform = '';

  const step = () => {
    const [first, second] = cards;
    // Absolute value: in RTL the second card sits to the LEFT of the first.
    return second
      ? Math.abs(second.offsetLeft - first.offsetLeft)
      : first.getBoundingClientRect().width + 16;
  };

  // In RTL, scrolling forward means decreasing scrollLeft (it goes negative).
  const forward = () => (document.documentElement.dir === 'rtl' ? -1 : 1);

  const atEnd = () =>
    Math.abs(track.scrollLeft) + track.clientWidth >= track.scrollWidth - 8;

  const scrollByCards = (count) => {
    track.scrollBy({ left: forward() * step() * count, behavior: 'smooth' });
  };

  elements.carouselPrev.addEventListener('click', () => scrollByCards(-1));
  elements.carouselNext.addEventListener('click', () => scrollByCards(1));

  // Auto-play: advance one card, then rewind to the start at the end.
  const advance = () => {
    if (atEnd()) {
      track.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      scrollByCards(1);
    }
  };

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let autoPlayInterval = prefersReducedMotion ? null : setInterval(advance, CONFIG.carouselAutoPlay);

  const pauseAutoPlay = () => {
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
  };

  const resumeAutoPlay = () => {
    if (!autoPlayInterval && !prefersReducedMotion) {
      autoPlayInterval = setInterval(advance, CONFIG.carouselAutoPlay);
    }
  };

  track.addEventListener('mouseenter', pauseAutoPlay);
  track.addEventListener('mouseleave', resumeAutoPlay);
  // Once the customer swipes, stop moving content under their finger.
  track.addEventListener('touchstart', pauseAutoPlay, { passive: true });
}

// ============================================
// DISH MODAL
// ============================================
function openDishModal(dish) {
  state.currentDish = dish;
  
  // Image
  elements.modalImg.src = dishImage(dish);
  elements.modalImg.alt = getText(dish, 'name');

  // Only offer AR when a model exists — see hasArModel().
  if (elements.modalArBtn) {
    elements.modalArBtn.hidden = !hasArModel(dish);
  }
  
  // Badges
  const badges = [];
  if (dish.isFeatured) badges.push({ class: 'badge-featured', text: 'Featured' });
  if (dish.nutrition?.dietary?.includes('vegetarian')) badges.push({ class: 'badge-vegetarian', text: 'Vegetarian' });
  if (dish.nutrition?.dietary?.includes('vegan')) badges.push({ class: 'badge-vegan', text: 'Vegan' });
  if (dish.nutrition?.dietary?.includes('gluten-free')) badges.push({ class: 'badge-gluten-free', text: 'Gluten-Free' });
  if (dish.nutrition?.dietary?.includes('spicy')) badges.push({ class: 'badge-spicy', text: 'Spicy' });
  
  elements.modalBadges.innerHTML = badges.map(b => 
    `<span class="badge ${b.class}">${b.text}</span>`
  ).join('');
  
  // Info
  elements.modalTitle.textContent = getText(dish, 'name');
  elements.modalDescription.textContent = getText(dish, 'description', 'No description available');
  elements.modalPrice.textContent = formatPrice(dish.price, dish.currency);
  elements.modalCategory.textContent = categoryLabel(dish.category);
  
  // Nutrition
  if (dish.nutrition && (dish.nutrition.calories || dish.nutrition.protein || dish.nutrition.carbs || dish.nutrition.fat)) {
    elements.modalNutrition.hidden = false;
    elements.modalNutritionGrid.innerHTML = `
      <div class="nutrition-item">
        <span class="nutrition-value">${dish.nutrition.calories || '—'}</span>
        <span class="nutrition-label">Calories</span>
      </div>
      <div class="nutrition-item">
        <span class="nutrition-value">${dish.nutrition.protein || 0}g</span>
        <span class="nutrition-label">Protein</span>
      </div>
      <div class="nutrition-item">
        <span class="nutrition-value">${dish.nutrition.carbs || 0}g</span>
        <span class="nutrition-label">Carbs</span>
      </div>
      <div class="nutrition-item">
        <span class="nutrition-value">${dish.nutrition.fat || 0}g</span>
        <span class="nutrition-label">Fat</span>
      </div>
    `;
  } else {
    elements.modalNutrition.hidden = true;
  }
  
  // Allergens
  if (dish.nutrition?.allergens?.length) {
    elements.modalAllergens.hidden = false;
    elements.modalAllergenTags.innerHTML = dish.nutrition.allergens.map(a => 
      `<span class="allergen-tag">${a}</span>`
    ).join('');
  } else {
    elements.modalAllergens.hidden = true;
  }
  
  // Dietary
  if (dish.nutrition?.dietary?.length) {
    elements.modalDietary.hidden = false;
    elements.modalDietaryTags.innerHTML = dish.nutrition.dietary.map(d => 
      `<span class="dietary-tag">${d}</span>`
    ).join('');
  } else {
    elements.modalDietary.hidden = true;
  }
  
  // Show modal
  elements.dishModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  
  gsap.fromTo(elements.dishModal,
    { opacity: 0 },
    { opacity: 1, duration: 0.3 }
  );
  
  gsap.fromTo(elements.dishModal.querySelector('.modal-content'),
    { scale: 0.9, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }
  );
}

function closeDishModal() {
  gsap.to(elements.dishModal, {
    opacity: 0,
    duration: 0.2,
    onComplete: () => {
      elements.dishModal.classList.add('hidden');
      document.body.style.overflow = '';
      state.currentDish = null;
    }
  });
}

// ============================================
// ORDER MANAGEMENT
// ============================================
/**
 * The basket lived only in memory, so it was silently wiped the moment the
 * customer left the page — including the trip to /view to inspect a dish in 3D,
 * which is the whole point of the product. Persisting it in localStorage under a
 * key shared with /view keeps one basket across both pages.
 */
const ORDER_KEY = 'talabati.order.v1';

function persistOrder() {
  try {
    const payload = state.order.map((item) => ({
      id: item.dish._id,
      name: getText(item.dish, 'name'),
      price: Number(item.dish.price) || 0,
      currency: item.dish.currency || 'DZD',
      image: dishImage(item.dish),
      quantity: item.quantity
    }));
    localStorage.setItem(ORDER_KEY, JSON.stringify(payload));
  } catch (_) {
    // Private mode / quota exceeded: the in-memory basket still works.
  }
}

function restoreOrder() {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
  } catch (_) {
    saved = [];
  }
  if (!Array.isArray(saved) || saved.length === 0) return;

  state.order = saved.map((item) => {
    // Prefer the live dish record (fresh price/name); fall back to the stored
    // snapshot so an item removed from the menu doesn't vanish without a trace.
    const live = allDishes().find((dish) => dish._id === item.id);
    return {
      dish: live || {
        _id: item.id,
        name: item.name,
        price: item.price,
        currency: item.currency,
        image: item.image
      },
      quantity: Math.max(1, Number(item.quantity) || 1),
      addedAt: new Date()
    };
  });

  updateOrderUI();
  elements.orderToggle.classList.remove('hidden');
}

// `triggerEvent` is passed explicitly: the previous version relied on the
// implicit global `window.event`, which is undefined outside Chrome and threw a
// ReferenceError when the dish modal's "Add to order" button was used.
function addToOrder(dish, triggerEvent = null) {
  const existingItem = state.order.find(item => item.dish._id === dish._id);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    state.order.push({
      dish: dish,
      quantity: 1,
      addedAt: new Date()
    });
  }
  
  updateOrderUI();
  showToast(`${getText(dish, 'name')} added to order`, 'success');
  
  // Show order toggle on mobile
  if (window.innerWidth < 768) {
    elements.orderToggle.classList.remove('hidden');
  }
  
  // Animate button
  const btn = triggerEvent?.target?.closest?.('.btn-add-order');
  if (btn) {
    gsap.fromTo(btn,
      { scale: 1 },
      { scale: 1.2, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out' }
    );
  }
}

function removeFromOrder(dishId) {
  state.order = state.order.filter(item => item.dish._id !== dishId);
  updateOrderUI();
}

function updateQuantity(dishId, delta) {
  const item = state.order.find(item => item.dish._id === dishId);
  if (item) {
    item.quantity = Math.max(1, item.quantity + delta);
    if (item.quantity === 1 && delta < 0) {
      removeFromOrder(dishId);
    } else {
      updateOrderUI();
    }
  }
}

function updateOrderUI() {
  // Update order items
  if (state.order.length === 0) {
    elements.orderItems.innerHTML = '<p class="order-empty">Your order is empty</p>';
    elements.orderSummary.hidden = true;
  } else {
    elements.orderItems.innerHTML = '';
    state.order.forEach(item => {
      const dish = item.dish;
      const itemEl = document.createElement('div');
      itemEl.className = 'order-item';
      itemEl.innerHTML = `
        <img src="${dishImage(dish)}" alt="${getText(dish, 'name')}" class="order-item-image">
        <div class="order-item-info">
          <h4 class="order-item-name">${getText(dish, 'name')}</h4>
          <div class="order-item-price">${formatPrice(dish.price, dish.currency)}</div>
          <div class="order-item-controls">
            <button class="quantity-btn btn-decrease" data-dish-id="${dish._id}" aria-label="Decrease quantity">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <span class="quantity-value">${item.quantity}</span>
            <button class="quantity-btn btn-increase" data-dish-id="${dish._id}" aria-label="Increase quantity">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        </div>
        <span class="order-item-total">${formatPrice(dish.price * item.quantity, dish.currency)}</span>
      `;
      
      itemEl.querySelector('.btn-decrease').addEventListener('click', () => updateQuantity(dish._id, -1));
      itemEl.querySelector('.btn-increase').addEventListener('click', () => updateQuantity(dish._id, 1));
      
      elements.orderItems.appendChild(itemEl);
    });
    elements.orderSummary.hidden = false;
  }
  
  // Update summary
  const subtotal = state.order.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;
  
  const orderCurrency = state.order[0]?.dish.currency || 'DZD';
  elements.orderSubtotal.textContent = formatPrice(subtotal, orderCurrency);
  elements.orderTax.textContent = formatPrice(tax, orderCurrency);
  elements.orderTotal.textContent = formatPrice(total, orderCurrency);
  
  // Update mobile toggle
  const totalItems = state.order.reduce((sum, item) => sum + item.quantity, 0);
  elements.orderCount.textContent = totalItems;
  elements.orderTotalText.textContent = formatPrice(total, orderCurrency);

  persistOrder();
}

function toggleOrderSidebar() {
  state.isOrderSidebarOpen = !state.isOrderSidebarOpen;
  elements.orderSidebar.classList.toggle('open', state.isOrderSidebarOpen);
  document.body.style.overflow = state.isOrderSidebarOpen ? 'hidden' : '';
}

function closeOrderSidebar() {
  state.isOrderSidebarOpen = false;
  elements.orderSidebar.classList.remove('open');
  document.body.style.overflow = '';
}

// ============================================
// 3D / AR NAVIGATION
// ============================================
/**
 * Both buttons now point at /view (model-viewer) instead of the old /ar page.
 *
 * WHY: /ar loaded AR.js (marker tracking) and WebXR `ar-hit-test` in the same
 * A-Frame scene. WebXR needs a session started by an explicit user gesture,
 * which AR.js never starts, so `hit-test-result` never fired and the screen sat
 * on "جاري البحث عن سطح" forever — and on iOS Safari (no WebXR) it could never
 * work at all. /view always renders the dish in 3D and defers real AR to the
 * platform (Scene Viewer / Quick Look).
 */
function buildViewUrl(dishId) {
  const params = new URLSearchParams({ dish: dishId });
  // Keeps the "back to menu" link pointing at the right restaurant.
  const slug = state.restaurantSlug || resolveRestaurantSlug();
  if (slug) params.set('r', slug);
  return `/view?${params.toString()}`;
}

/** Collects dishes regardless of whether they are grouped by category. */
function allDishes() {
  const data = state.menuData;
  if (!data) return [];
  if (Array.isArray(data.dishes) && data.dishes.length) return data.dishes;
  if (Array.isArray(data.categories)) {
    return data.categories.flatMap((category) => category.dishes || []);
  }
  return [];
}

/**
 * The header's AR button has no dish context. Previously it opened /ar with no
 * dish at all — a camera view with nothing to show, which is exactly what the
 * pilot test hit. Now it opens the first dish that actually has a 3D model.
 */
function navigateToAR() {
  const dish = allDishes().find((item) => hasArModel(item));

  if (!dish) {
    showToast('لا يوجد طبق بمجسّم ثلاثي الأبعاد في هذه القائمة بعد', 'info');
    return;
  }

  window.location.href = buildViewUrl(dish._id);
}

function navigateToARDish(dishId) {
  window.location.href = buildViewUrl(dishId);
}

// ============================================
// LANGUAGE HANDLING
// ============================================
function toggleLanguage() {
  const languages = ['en', 'ar', 'fr', 'es'];
  const currentIndex = languages.indexOf(state.language);
  const nextIndex = (currentIndex + 1) % languages.length;
  state.language = languages[nextIndex];
  
  updateUILanguage();
  showToast(`Language: ${state.language.toUpperCase()}`, 'info');
}

function updateUILanguage() {
  if (state.restaurantData) {
    elements.restaurantName.textContent = getText(state.restaurantData, 'name');
    elements.restaurantTagline.textContent = getText(state.restaurantData, 'description', 'Fine Dining Experience');
    elements.footerName.textContent = getText(state.restaurantData, 'name');
  }
  
  // Rebuild category navigation
  buildCategoryNavigation();
  
  // Rebuild menu sections
  if (state.currentCategory) {
    buildMenuSections(state.currentCategory);
  }
  
  // Rebuild featured carousel
  buildFeaturedCarousel();
  
  // Update modal if open
  if (state.currentDish) {
    openDishModal(state.currentDish);
  }
  
  // Update order UI
  updateOrderUI();
  
  // Update document direction
  document.documentElement.dir = state.language === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = state.language;
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // AR Mode button
  elements.btnArMode.addEventListener('click', navigateToAR);
  
  // Language button
  elements.btnLanguage.addEventListener('click', toggleLanguage);
  
  // Modal close
  elements.modalClose.addEventListener('click', closeDishModal);
  elements.dishModal.querySelector('.modal-backdrop').addEventListener('click', closeDishModal);
  
  // Modal actions
  elements.modalArBtn.addEventListener('click', () => {
    if (state.currentDish) {
      navigateToARDish(state.currentDish._id);
    }
  });
  
  elements.modalOrderBtn.addEventListener('click', () => {
    if (state.currentDish) {
      addToOrder(state.currentDish);
      closeDishModal();
      toggleOrderSidebar();
    }
  });
  
  // Order sidebar
  elements.closeOrder.addEventListener('click', closeOrderSidebar);
  elements.orderToggle.addEventListener('click', toggleOrderSidebar);
  
  // Checkout
  elements.btnCheckout.addEventListener('click', () => {
    showToast('Checkout functionality coming soon!', 'info');
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDishModal();
      closeOrderSidebar();
    }
  });
  
  // Close sidebar on backdrop click (mobile)
  elements.orderSidebar.addEventListener('click', (e) => {
    if (e.target === elements.orderSidebar) {
      closeOrderSidebar();
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================
async function init() {
  try {
    initDOMElements();
    setupEventListeners();
    
    await fetchRestaurantData();
    updateRestaurantBranding();
    
    await fetchMenuData();
    
    buildCategoryNavigation();
    buildFeaturedCarousel();
    buildMenuSections();

    // Picks up anything added from the 3D viewer before coming back here.
    restoreOrder();
    
    showLoading(100);
    setTimeout(hideLoading, 300);
    
    console.log('Menu initialized successfully');
    
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Failed to load menu', 'error');
    hideLoading();
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.MenuApp = {
  state,
  addToOrder,
  showToast,
  navigateToAR
};