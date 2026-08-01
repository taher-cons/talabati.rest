/**
 * WebAR Menu - Main AR Experience Module
 * Handles AR scene initialization, model loading, gestures, and UI interactions
 */

/*
 * IMPORTANT: We deliberately DO NOT import three.js from a CDN here.
 * A-Frame already bundles its own three.js build and exposes it as `window.THREE`
 * (together with THREE.GLTFLoader / THREE.DRACOLoader).
 * Importing a second copy of three caused two serious production bugs:
 *   1. `Failed to resolve module specifier "three"` — because three's
 *      examples/jsm/* files use a bare "three" import specifier.
 *   2. Duplicate three instances conflicting with A-Frame's renderer
 *      (useLegacyLights / setShadowMapEnabled TypeErrors).
 * Using A-Frame's bundled THREE keeps a single instance and stays compatible
 * with the A-Frame scene graph.
 */
const THREE = window.THREE;
const GLTFLoader = THREE.GLTFLoader;
const DRACOLoader = THREE.DRACOLoader;


// GSAP & ScrollTrigger - Using ES Module compatible CDN (jsdelivr)
import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';
import ScrollTrigger from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger/+esm';

gsap.registerPlugin(ScrollTrigger);

// ============================================
// CONFIGURATION & STATE
// ============================================
const CONFIG = {
  apiBase: '/api/menu',
  /**
   * Real-world width we want a dish to occupy on the table, in metres.
   * A fixed `modelScale` multiplier used to be applied blindly, which is wrong:
   * exported GLB files come in wildly different units (the pilot pizza is 0.92
   * units wide, so 0.92 x 0.01 rendered a 9 mm pizza — invisible). We now
   * measure each model and fit it to this size instead.
   */
  targetDishSize: 0.28,
  /**
   * AR.js marker space is normalised to the printed marker (~1 unit), not
   * metres, so models on a marker need a separate conversion factor. Assumes a
   * ~10 cm printed marker.
   */
  markerUnitsPerMetre: 10,
  defaultAnimation: 'rotate',
  loadingTimeout: 30000,
  gestureSensitivity: {
    scale: 0.005,
    rotation: 0.01,
    translation: 0.002
  }
};

const state = {
  menuId: null,
  menuData: null,
  restaurantData: null,
  currentDish: null,
  currentCategory: null,
  dishesByCategory: {},
  arMode: 'surface', // 'surface', 'marker', 'both'
  isARReady: false,
  isModelLoaded: false,
  isSurfaceFound: false,
  currentModel: null,
  // Uniform scale that fits the current model to a real-world dish size; it is
  // the reference point for pinch-zoom limits.
  baseScale: 1,
  animations: [],
  order: [],
  language: 'en',
  settings: {
    shadows: true,
    autoRotate: true,
    showNutrition: false
  }
};

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {};

// Initialize DOM references
function initDOMElements() {
  elements.loadingScreen = document.getElementById('loading-screen');
  elements.loadingBar = document.getElementById('loading-bar');
  elements.loadingPercent = document.getElementById('loading-percent');
  elements.arScene = document.getElementById('ar-scene');
  elements.arSceneEl = document.getElementById('ar-scene-element');
  elements.uiOverlay = document.getElementById('ui-overlay');
  elements.arInstructions = document.getElementById('ar-instructions');
  elements.instructionSurface = document.getElementById('instruction-surface');
  elements.instructionTap = document.getElementById('instruction-tap');
  elements.instructionGesture = document.getElementById('instruction-gesture');
  elements.dishInfoPanel = document.getElementById('dish-info-panel');
  elements.dishThumbnail = document.getElementById('dish-thumbnail');
  elements.dishName = document.getElementById('dish-name');
  elements.dishDescription = document.getElementById('dish-description');
  elements.dishPrice = document.getElementById('dish-price');
  elements.dishCategory = document.getElementById('dish-category');
  elements.dishNutrition = document.getElementById('dish-nutrition');
  elements.nutCalories = document.getElementById('nut-calories');
  elements.nutProtein = document.getElementById('nut-protein');
  elements.nutCarbs = document.getElementById('nut-carbs');
  elements.nutFat = document.getElementById('nut-fat');
  elements.categorySelector = document.getElementById('category-selector');
  elements.categoryScroll = document.getElementById('category-scroll');
  elements.bottomControls = document.getElementById('bottom-controls');
  elements.sideMenu = document.getElementById('side-menu');
  elements.categoryTabs = document.getElementById('category-tabs');
  elements.dishesList = document.getElementById('dishes-list');
  elements.menuSearch = document.getElementById('menu-search');
  elements.settingsPanel = document.getElementById('settings-panel');
  elements.helpModal = document.getElementById('help-modal');
  elements.capturePreview = document.getElementById('capture-preview');
  elements.capturedImage = document.getElementById('captured-image');
  elements.toastContainer = document.getElementById('toast-container');
  elements.restaurantLogo = document.getElementById('restaurant-logo');
  elements.restaurantName = document.getElementById('restaurant-name');
  elements.restaurantTagline = document.getElementById('restaurant-tagline');
  
  // A-Frame elements
  elements.foodModel = document.getElementById('food-model');
  elements.tableAnchor = document.getElementById('table-anchor');
  elements.tableRing = document.getElementById('table-ring');
  elements.hitPlane = document.getElementById('hit-plane');
  elements.arCamera = document.getElementById('ar-camera');
  elements.hiroMarker = document.getElementById('hiro-marker');
  elements.customMarker = document.getElementById('custom-marker');
  elements.markerFoodModel = document.getElementById('marker-food-model');
  elements.patternFoodModel = document.getElementById('pattern-food-model');
  
  // Buttons
  elements.btnViewDetails = document.getElementById('btn-view-details');
  elements.btnAddToOrder = document.getElementById('btn-add-to-order');
  elements.btnResetAR = document.getElementById('btn-reset-ar');
  elements.btnSwitchCamera = document.getElementById('btn-switch-camera');
  elements.btnCapture = document.getElementById('btn-capture');
  elements.btnToggleMarker = document.getElementById('btn-toggle-marker');
  elements.btnHelp = document.getElementById('btn-help');
  elements.btnMenuToggle = document.getElementById('menu-toggle');
  elements.btnSettingsToggle = document.getElementById('settings-toggle');
  elements.btnCloseMenu = document.getElementById('close-menu');
  elements.btnCloseSettings = document.getElementById('close-settings');
  elements.btnRetake = document.getElementById('btn-retake');
  elements.btnSavePhoto = document.getElementById('btn-save-photo');
  elements.btnSharePhoto = document.getElementById('btn-share-photo');
  
  // Settings
  elements.settingShadows = document.getElementById('setting-shadows');
  elements.settingAutoRotate = document.getElementById('setting-auto-rotate');
  elements.settingShowNutrition = document.getElementById('setting-show-nutrition');
  elements.settingLanguage = document.getElementById('setting-language');
  elements.arModeRadios = document.querySelectorAll('input[name="ar-mode"]');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showLoading(percent, text = '') {
  if (elements.loadingBar) {
    elements.loadingBar.style.width = `${percent}%`;
  }
  if (elements.loadingPercent) {
    elements.loadingPercent.textContent = `${Math.round(percent)}%`;
  }
}

function hideLoading() {
  if (elements.loadingScreen) {
    gsap.to(elements.loadingScreen, {
      opacity: 0,
      duration: 0.5,
      onComplete: () => {
        elements.loadingScreen.style.display = 'none';
        elements.arScene.hidden = false;
        gsap.fromTo(elements.uiOverlay, 
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
        );
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

function formatPrice(price, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(price);
}

function getText(obj, field, fallback = '') {
  const langField = state.language !== 'en' ? `${field}${state.language.charAt(0).toUpperCase() + state.language.slice(1)}` : field;
  return obj[langField] || obj[field] || fallback;
}

// ============================================
// API FUNCTIONS
// ============================================
async function fetchMenuData() {
  showLoading(10, 'Fetching menu...');
  
  try {
    // Extract menuId from URL
    const pathParts = window.location.pathname.split('/');
    state.menuId = pathParts[pathParts.length - 1];
    
    const response = await fetch(`${CONFIG.apiBase}/${state.menuId}`);
    if (!response.ok) throw new Error('Menu not found');
    
    state.menuData = await response.json();
    state.restaurantData = state.menuData.restaurant;
    
    showLoading(30, 'Processing menu data...');
    
    // Organize dishes by category
    state.menuData.dishes.forEach(dish => {
      if (!state.dishesByCategory[dish.category]) {
        state.dishesByCategory[dish.category] = [];
      }
      if (dish.isAvailable) {
        state.dishesByCategory[dish.category].push(dish);
      }
    });
    
    // Sort dishes by displayOrder
    Object.keys(state.dishesByCategory).forEach(cat => {
      state.dishesByCategory[cat].sort((a, b) => a.displayOrder - b.displayOrder);
    });
    
    showLoading(50, 'Menu loaded');
    return state.menuData;
  } catch (error) {
    console.error('Error fetching menu:', error);
    showToast('Failed to load menu. Please refresh.', 'error');
    throw error;
  }
}

async function fetchDishDetails(dishId) {
  try {
    const response = await fetch(`${CONFIG.apiBase}/dish/${dishId}`);
    if (!response.ok) throw new Error('Dish not found');
    return await response.json();
  } catch (error) {
    console.error('Error fetching dish:', error);
    showToast('Failed to load dish details', 'error');
    throw error;
  }
}

// ============================================
// AR SCENE INITIALIZATION
// ============================================
function initARScene() {
  return new Promise((resolve) => {
    // Wait for A-Frame to be ready
    if (elements.arSceneEl.hasLoaded) {
      resolve();
    } else {
      elements.arSceneEl.addEventListener('loaded', () => resolve(), { once: true });
    }
  }).then(() => {
    showLoading(60, 'Initializing AR...');
    
    // Configure AR.js
    const arjsSystem = elements.arSceneEl.systems.arjs;
    if (arjsSystem) {
      // Configure for surface detection
      arjsSystem.arController.orientation = 'portrait';
    }
    
    // Set up hit-test for surface detection
    setupHitTest();
    
    // Set up gesture handling
    setupGestures();
    
    // Set up camera switching
    setupCameraControls();
    
    showLoading(80, 'AR ready');
    state.isARReady = true;
  });
}

function setupHitTest() {
  // Listen for hit-test results
  elements.tableAnchor.addEventListener('hit-test-result', (event) => {
    const { position, rotation } = event.detail;
    
    if (!state.isSurfaceFound) {
      state.isSurfaceFound = true;
      showSurfaceFound();
    }
    
    // Update table ring position
    elements.tableRing.object3D.position.copy(position);
    elements.tableRing.object3D.quaternion.copy(rotation);
    elements.tableRing.setAttribute('visible', 'true');
    
    // Update hit plane for gesture detection
    elements.hitPlane.object3D.position.copy(position);
    elements.hitPlane.object3D.quaternion.copy(rotation);
  });
  
  // Listen for hit-test start
  elements.tableAnchor.addEventListener('hit-test-start', () => {
    elements.tableRing.setAttribute('visible', 'true');
  });
}

function showSurfaceFound() {
  // Animate instructions
  gsap.to(elements.instructionSurface, {
    opacity: 0.5,
    scale: 0.95,
    duration: 0.3
  });
  
  gsap.to(elements.instructionTap, {
    opacity: 1,
    scale: 1,
    duration: 0.5,
    delay: 0.3,
    ease: 'back.out(1.7)'
  });
  
  // Pulse the ring
  elements.tableRing.setAttribute('animation__pulse', {
    property: 'scale',
    from: '1 1 1',
    to: '1.3 1.3 1.3',
    dur: 1000,
    easing: 'easeInOutQuad',
    loop: true,
    dir: 'alternate'
  });
}

// ============================================
// 3D MODEL LOADING
// ============================================
/**
 * Returns the uniform scale that makes `object3D` occupy CONFIG.targetDishSize
 * metres along its longest edge.
 *
 * Why this exists: GLB exports have no reliable unit convention — a model may be
 * 0.9 units wide (metres), 90 (centimetres) or 900 (millimetres). Multiplying
 * everything by one hard-coded constant therefore produced either invisible
 * specks or dishes the size of a car. Measuring the bounding box makes any
 * uploaded model appear at a believable size with no manual tuning.
 */
function fitScaleFor(object3D) {
  const size = new THREE.Box3().setFromObject(object3D).getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);

  // Degenerate or empty geometry: never divide by zero.
  if (!Number.isFinite(longest) || longest <= 0) return 1;

  return CONFIG.targetDishSize / longest;
}

/**
 * Keeps pinch/wheel zoom sane *relative to the fitted size*. The previous
 * absolute clamp (0.001–0.1) predated auto-fitting and would snap every
 * realistic scale back down to a speck.
 */
function clampModelScale(newScale) {
  const base = state.baseScale || 1;
  return THREE.MathUtils.clamp(newScale, base * 0.4, base * 3);
}

/**
 * Builds a placeholder "dish on a plate" when the real GLB is missing, broken
 * or too slow. Without this the user is left staring at a raw camera feed with
 * no explanation, which reads as "the app is broken".
 * Uses the dish thumbnail as a texture when one exists.
 */
function buildFallbackModel(dish) {
  const group = new THREE.Group();

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.28, 0.03, 48),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.35, metalness: 0.05 })
  );
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  const thumbUrl = dish?.model3D?.thumbnail || dish?.image || '';
  const topMaterial = new THREE.MeshStandardMaterial({
    color: thumbUrl ? 0xffffff : 0xe94560,
    roughness: 0.6,
    metalness: 0.05,
  });

  if (thumbUrl) {
    // A failed texture load must not break the fallback itself.
    new THREE.TextureLoader().load(
      thumbUrl,
      (texture) => {
        topMaterial.map = texture;
        topMaterial.needsUpdate = true;
      },
      undefined,
      () => console.warn('[ar] fallback thumbnail failed to load')
    );
  }

  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.24, 48), topMaterial);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.017;
  group.add(disc);

  group.userData.isFallback = true;
  return group;
}

function showFallbackModel(dish, message) {
  try {
    if (state.currentModel) removeCurrentModel();

    const fallback = buildFallbackModel(dish);
    state.baseScale = fitScaleFor(fallback);
    fallback.scale.multiplyScalar(state.baseScale);
    elements.foodModel.setObject3D('mesh', fallback);
    elements.foodModel.setAttribute('visible', 'true');

    state.currentModel = fallback;
    state.isModelLoaded = false; // a placeholder is not a real model
    state.currentDish = dish;

    startModelAnimation('rotate');
    updateDishInfoPanel(dish);
    showToast(message, 'warning', 6000);
  } catch (err) {
    console.error('[ar] fallback rendering failed:', err);
  } finally {
    hideLoading();
  }
  return null;
}

async function loadDishModel(dish) {
  if (!dish.model3D?.url) {
    // Still show the dish (name, price, description) with a placeholder plate
    // instead of an empty camera view.
    return showFallbackModel(dish, 'No 3D model for this dish yet — showing a placeholder');
  }

  showLoading(85, 'Loading 3D model...');
  state.currentDish = dish;

  try {

    // Remove existing model
    if (state.currentModel) {
      removeCurrentModel();
    }
    
    // Load GLTF/GLB model
    const loader = new GLTFLoader();
    
    // Setup DRACO loader for compressed models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    loader.setDRACOLoader(dracoLoader);
    
    const gltf = await loader.loadAsync(dish.model3D.url);
    const model = gltf.scene;
    
    // Configure model
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Enhance materials for food
        if (child.material) {
          child.material.metalness = 0.1;
          child.material.roughness = 0.7;
          child.material.envMapIntensity = 1.2;
        }
      }
    });
    
    // Apply dish-specific transform.
    // `scale` from the database is a *relative* tweak (1 = natural size); the
    // absolute sizing comes from fitScaleFor(), so restaurant staff never have
    // to reason about model units.
    const scale = dish.model3D.scale || { x: 1, y: 1, z: 1 };
    const position = dish.model3D.position || { x: 0, y: 0, z: 0 };
    const rotation = dish.model3D.rotation || { x: 0, y: 0, z: 0 };
    
    const fit = fitScaleFor(model);
    state.baseScale = fit;
    model.scale.set(scale.x * fit, scale.y * fit, scale.z * fit);
    model.position.set(position.x, position.y, position.z);
    model.rotation.set(
      THREE.MathUtils.degToRad(rotation.x),
      THREE.MathUtils.degToRad(rotation.y),
      THREE.MathUtils.degToRad(rotation.z)
    );
    
    // Add to food model container
    elements.foodModel.setObject3D('mesh', model);
    elements.foodModel.setAttribute('visible', 'true');
    
    // Also add to marker containers
    if (elements.markerFoodModel) {
      const markerModel = model.clone(true);
      // Marker space is not metric — see CONFIG.markerUnitsPerMetre.
      markerModel.scale.multiplyScalar(CONFIG.markerUnitsPerMetre);
      elements.markerFoodModel.setObject3D('mesh', markerModel);
      elements.markerFoodModel.setAttribute('visible', 'true');
    }
    
    if (elements.patternFoodModel) {
      const patternModel = model.clone(true);
      patternModel.scale.multiplyScalar(CONFIG.markerUnitsPerMetre);
      elements.patternFoodModel.setObject3D('mesh', patternModel);
      elements.patternFoodModel.setAttribute('visible', 'true');
    }
    
    state.currentModel = model;
    state.isModelLoaded = true;
    
    // Start animation
    startModelAnimation(dish.model3D.animation || CONFIG.defaultAnimation);
    
    // Update dish info panel
    updateDishInfoPanel(dish);
    
    showLoading(100, 'Ready!');
    setTimeout(hideLoading, 500);
    
    showToast(`${getText(dish, 'name')} loaded in AR`, 'success');
    
    return model;
  } catch (error) {
    // Common causes: the GLB 404s, Storage is unreachable, the file is corrupt,
    // or the device ran out of memory. Degrade to a placeholder so the menu is
    // still usable instead of leaving a blank camera view.
    console.error('Error loading model:', error);
    return showFallbackModel(dish, "Couldn't load the 3D model — showing a placeholder");
  }
}


function removeCurrentModel() {
  if (state.currentModel) {
    // GSAP tweens expose kill(), not stop(): calling stop() threw a TypeError
    // and aborted model cleanup, so switching dishes leaked the previous model.
    stopModelAnimations();

    
    // Remove from scene
    elements.foodModel.removeObject3D('mesh');
    elements.foodModel.setAttribute('visible', 'false');
    
    if (elements.markerFoodModel) {
      elements.markerFoodModel.removeObject3D('mesh');
      elements.markerFoodModel.setAttribute('visible', 'false');
    }
    
    if (elements.patternFoodModel) {
      elements.patternFoodModel.removeObject3D('mesh');
      elements.patternFoodModel.setAttribute('visible', 'false');
    }
    
    // Dispose geometries and materials
    state.currentModel.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
    
    state.currentModel = null;
    state.isModelLoaded = false;
  }
}

function startModelAnimation(animationType) {
  if (!state.currentModel) return;
  if (!state.settings.autoRotate && animationType !== 'none') return;

  const model = state.currentModel;

  // GSAP relative values must be numbers in a string ('+=6.28318'); it does not
  // evaluate expressions, so the old '+=2*Math.PI' produced NaN and no rotation.
  const FULL_TURN = '+=6.28318';

  switch (animationType) {
    case 'rotate':
      const rotateAnim = gsap.to(model.rotation, {
        y: FULL_TURN,

        duration: 20,
        ease: 'none',
        repeat: -1
      });
      state.animations.push(rotateAnim);
      break;
      
    case 'float':
      const floatAnim = gsap.to(model.position, {
        y: '+=0.02',
        duration: 2,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1
      });
      state.animations.push(floatAnim);
      
      const floatRotate = gsap.to(model.rotation, {
        y: '+=0.5',
        duration: 4,
        ease: 'none',
        repeat: -1
      });
      state.animations.push(floatRotate);
      break;
      
    case 'spin':
      const spinAnim = gsap.to(model.rotation, {
        y: FULL_TURN,

        duration: 5,
        ease: 'none',
        repeat: -1
      });
      state.animations.push(spinAnim);
      break;
      
    case 'none':
    default:
      // No animation
      break;
  }
}

function stopModelAnimations() {
  state.animations.forEach(anim => anim.kill());
  state.animations = [];
}

// ============================================
// GESTURE HANDLING
// ============================================
function setupGestures() {
  // Touch events for model manipulation
  let initialScale = 1;
  let initialRotation = { x: 0, y: 0, z: 0 };
  let initialPosition = { x: 0, y: 0, z: 0 };
  let lastTouchDistance = 0;
  let lastTouchCenter = { x: 0, y: 0 };
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  
  // Hit plane for raycasting
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  function getTouchDistance(touches) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  function getTouchCenter(touches) {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }
  
  // Touch start
  elements.arSceneEl.addEventListener('touchstart', (event) => {
    if (!state.isModelLoaded || !state.isSurfaceFound) return;
    
    if (event.touches.length === 1) {
      // Single tap - could be for placement or selection
      const touch = event.touches[0];
      dragStart = { x: touch.clientX, y: touch.clientY };
      isDragging = true;
      
      // Check if tapping on model
      checkModelTap(touch);
    } else if (event.touches.length === 2) {
      // Pinch gesture - store initial values
      lastTouchDistance = getTouchDistance(event.touches);
      lastTouchCenter = getTouchCenter(event.touches);
      initialScale = state.currentModel?.scale.x || state.baseScale || 1;
      isDragging = false;
    }
  }, { passive: true });
  
  // Touch move
  elements.arSceneEl.addEventListener('touchmove', (event) => {
    if (!state.isModelLoaded || !state.currentModel) return;
    event.preventDefault();
    
    if (event.touches.length === 1 && isDragging) {
      // Drag to rotate
      const touch = event.touches[0];
      const deltaX = touch.clientX - dragStart.x;
      const deltaY = touch.clientY - dragStart.y;
      
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        state.currentModel.rotation.y += deltaX * CONFIG.gestureSensitivity.rotation;
        state.currentModel.rotation.x += deltaY * CONFIG.gestureSensitivity.rotation;
        dragStart = { x: touch.clientX, y: touch.clientY };
      }
    } else if (event.touches.length === 2) {
      // Pinch to scale
      const distance = getTouchDistance(event.touches);
      const center = getTouchCenter(event.touches);
      
      if (lastTouchDistance > 0) {
        const scaleFactor = distance / lastTouchDistance;
        const newScale = initialScale * scaleFactor;
        state.currentModel.scale.setScalar(clampModelScale(newScale));
      }
      
      // Two finger drag for translation
      const deltaX = center.x - lastTouchCenter.x;
      const deltaY = center.y - lastTouchCenter.y;
      
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        // Convert screen delta to world delta
        const worldDelta = screenToWorldDelta(deltaX, deltaY);
        state.currentModel.position.x += worldDelta.x;
        state.currentModel.position.z += worldDelta.z;
        lastTouchCenter = center;
      }
    }
  }, { passive: false });
  
  // Touch end
  elements.arSceneEl.addEventListener('touchend', (event) => {
    isDragging = false;
    lastTouchDistance = 0;
    
    // Tap detection (short touch, minimal movement)
    if (event.changedTouches.length === 1) {
      const touch = event.changedTouches[0];
      const deltaX = Math.abs(touch.clientX - dragStart.x);
      const deltaY = Math.abs(touch.clientY - dragStart.y);
      
      if (deltaX < 10 && deltaY < 10) {
        // This was a tap - check if on model
        checkModelTap(touch);
      }
    }
  });
  
  // Mouse events for desktop testing
  elements.arSceneEl.addEventListener('mousedown', (event) => {
    if (!state.isModelLoaded || !state.currentModel) return;
    dragStart = { x: event.clientX, y: event.clientY };
    isDragging = true;
  });
  
  elements.arSceneEl.addEventListener('mousemove', (event) => {
    if (!isDragging || !state.currentModel) return;
    
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    
    state.currentModel.rotation.y += deltaX * CONFIG.gestureSensitivity.rotation;
    state.currentModel.rotation.x += deltaY * CONFIG.gestureSensitivity.rotation;
    dragStart = { x: event.clientX, y: event.clientY };
  });
  
  elements.arSceneEl.addEventListener('mouseup', () => {
    isDragging = false;
  });
  
  elements.arSceneEl.addEventListener('wheel', (event) => {
    if (!state.currentModel) return;
    event.preventDefault();
    
    const scaleFactor = event.deltaY > 0 ? 0.95 : 1.05;
    const newScale = state.currentModel.scale.x * scaleFactor;
    state.currentModel.scale.setScalar(clampModelScale(newScale));
  }, { passive: false });
  
  function checkModelTap(touch) {
    // Convert touch to normalized device coordinates
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, elements.arSceneEl.camera);
    
    const intersects = raycaster.intersectObject(state.currentModel, true);
    
    if (intersects.length > 0) {
      // Tapped on model
      showDishInfoPanel();
    }
  }
  
  function screenToWorldDelta(screenX, screenY) {
    // Approximate conversion from screen to world coordinates
    const distance = elements.arCamera.object3D.position.y; // Height from table
    const fov = THREE.MathUtils.degToRad(elements.arCamera.getAttribute('fov') || 60);
    const worldHeight = 2 * distance * Math.tan(fov / 2);
    const worldWidth = worldHeight * (window.innerWidth / window.innerHeight);
    
    return {
      x: (screenX / window.innerWidth) * worldWidth * 0.1,
      z: (screenY / window.innerHeight) * worldHeight * 0.1
    };
  }
}

// ============================================
// CAMERA CONTROLS
// ============================================
function setupCameraControls() {
  let currentCamera = 'back';
  
  elements.btnSwitchCamera.addEventListener('click', async () => {
    try {
      const stream = elements.arSceneEl.components.arjs?.video?.srcObject;
      if (stream) {
        const tracks = stream.getVideoTracks();
        if (tracks.length > 0) {
          const capabilities = tracks[0].getCapabilities();
          if (capabilities.facingMode) {
            currentCamera = currentCamera === 'back' ? 'front' : 'back';
            
            // Restart AR with new camera
            elements.arSceneEl.components.arjs.restart(currentCamera);
            
            showToast(`Switched to ${currentCamera} camera`, 'info');
          }
        }
      }
    } catch (error) {
      console.error('Camera switch error:', error);
      showToast('Could not switch camera', 'error');
    }
  });
}

// ============================================
// UI PANELS
// ============================================
function updateDishInfoPanel(dish) {
  elements.dishThumbnail.src = dish.model3D?.thumbnail || '';
  elements.dishThumbnail.alt = getText(dish, 'name');
  elements.dishName.textContent = getText(dish, 'name');
  elements.dishDescription.textContent = getText(dish, 'description', 'No description available');
  elements.dishPrice.textContent = formatPrice(dish.price, dish.currency);
  elements.dishCategory.textContent = dish.category.charAt(0).toUpperCase() + dish.category.slice(1);
  
  // Nutrition info
  if (dish.nutrition && state.settings.showNutrition) {
    elements.nutCalories.textContent = dish.nutrition.calories || '—';
    elements.nutProtein.textContent = `${dish.nutrition.protein || 0}g`;
    elements.nutCarbs.textContent = `${dish.nutrition.carbs || 0}g`;
    elements.nutFat.textContent = `${dish.nutrition.fat || 0}g`;
    elements.dishNutrition.hidden = false;
  } else {
    elements.dishNutrition.hidden = true;
  }
  
  // Allergens and dietary
  if (dish.nutrition?.allergens?.length || dish.nutrition?.dietary?.length) {
    // Could add allergen badges here
  }
}

function showDishInfoPanel() {
  elements.dishInfoPanel.classList.remove('hidden');
  gsap.fromTo(elements.dishInfoPanel,
    { opacity: 0, y: 50 },
    { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
  );
}

function hideDishInfoPanel() {
  gsap.to(elements.dishInfoPanel, {
    opacity: 0,
    y: 50,
    duration: 0.3,
    onComplete: () => elements.dishInfoPanel.classList.add('hidden')
  });
}

function buildCategorySelector() {
  if (!state.menuData) return;
  
  elements.categoryScroll.innerHTML = '';
  
  state.menuData.categories.forEach((category, index) => {
    if (!category.isActive) return;
    
    const btn = document.createElement('button');
    btn.className = `category-btn ${index === 0 ? 'active' : ''}`;
    btn.dataset.category = category.name;
    btn.innerHTML = `
      ${category.icon ? `<span class="category-icon">${category.icon}</span>` : ''}
      <span class="category-name">${getText(category, 'name')}</span>
      <span class="category-count">${state.dishesByCategory[category.name]?.length || 0}</span>
    `;
    
    btn.addEventListener('click', () => selectCategory(category.name, btn));
    elements.categoryScroll.appendChild(btn);
  });
  
  // Select first category by default
  const firstCategory = state.menuData.categories.find(c => c.isActive);
  if (firstCategory) {
    selectCategory(firstCategory.name);
  }
}

function selectCategory(categoryName, btnElement = null) {
  state.currentCategory = categoryName;
  
  // Update button states
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === categoryName);
  });
  
  // Build dishes list
  buildDishesList(categoryName);
  
  // Show category selector
  elements.categorySelector.classList.remove('hidden');
  gsap.fromTo(elements.categorySelector,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.3 }
  );
}

function buildDishesList(categoryName) {
  const dishes = state.dishesByCategory[categoryName] || [];
  
  elements.dishesList.innerHTML = '';
  
  if (dishes.length === 0) {
    elements.dishesList.innerHTML = '<p class="no-dishes">No dishes in this category</p>';
    return;
  }
  
  dishes.forEach((dish, index) => {
    const dishEl = document.createElement('div');
    dishEl.className = 'dish-item';
    dishEl.dataset.dishId = dish._id;
    dishEl.style.animationDelay = `${index * 50}ms`;
    dishEl.innerHTML = `
      <div class="dish-image">
        <img src="${dish.model3D?.thumbnail || ''}" alt="${getText(dish, 'name')}" loading="lazy">
        ${dish.isFeatured ? '<span class="featured-badge">⭐ Featured</span>' : ''}
      </div>
      <div class="dish-info">
        <h3 class="dish-title">${getText(dish, 'name')}</h3>
        <p class="dish-desc">${getText(dish, 'description', '')}</p>
        <div class="dish-footer">
          <span class="dish-price">${formatPrice(dish.price, dish.currency)}</span>
          <button class="btn-view-ar" data-dish-id="${dish._id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              <path d="M21 3l-6 6m2 5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            View in AR
          </button>
        </div>
      </div>
    `;
    
    dishEl.querySelector('.btn-view-ar').addEventListener('click', () => {
      loadDishModel(dish);
      closeSideMenu();
    });
    
    elements.dishesList.appendChild(dishEl);
  });
}

// ============================================
// SIDE MENU
// ============================================
function openSideMenu() {
  elements.sideMenu.classList.add('open');
  gsap.fromTo(elements.sideMenu,
    { x: 320 },
    { x: 0, duration: 0.4, ease: 'power2.out' }
  );
  buildCategorySelector();
}

function closeSideMenu() {
  gsap.to(elements.sideMenu, {
    x: 320,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => elements.sideMenu.classList.remove('open')
  });
}

// ============================================
// SETTINGS PANEL
// ============================================
function openSettingsPanel() {
  elements.settingsPanel.classList.add('open');
  gsap.fromTo(elements.settingsPanel,
    { x: 320 },
    { x: 0, duration: 0.4, ease: 'power2.out' }
  );
}

function closeSettingsPanel() {
  gsap.to(elements.settingsPanel, {
    x: 320,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => elements.settingsPanel.classList.remove('open')
  });
}

// ============================================
// HELP MODAL
// ============================================
function openHelpModal() {
  elements.helpModal.classList.remove('hidden');
  gsap.fromTo(elements.helpModal,
    { opacity: 0 },
    { opacity: 1, duration: 0.3 }
  );
  gsap.fromTo(elements.helpModal.querySelector('.modal-content'),
    { scale: 0.9, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }
  );
}

function closeHelpModal() {
  gsap.to(elements.helpModal, {
    opacity: 0,
    duration: 0.2,
    onComplete: () => elements.helpModal.classList.add('hidden')
  });
}

// ============================================
// CAPTURE PHOTO
// ============================================
function captureARPhoto() {
  try {
    const canvas = elements.arSceneEl.renderer.domElement;
    const dataURL = canvas.toDataURL('image/png', 1.0);
    
    elements.capturedImage.src = dataURL;
    elements.capturePreview.classList.remove('hidden');
    
    gsap.fromTo(elements.capturePreview,
      { opacity: 0, scale: 0.9 },
      { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.7)' }
    );
    
    showToast('Photo captured!', 'success');
  } catch (error) {
    console.error('Capture error:', error);
    showToast('Failed to capture photo', 'error');
  }
}

function savePhoto() {
  const link = document.createElement('a');
  link.download = `web-ar-menu-${Date.now()}.png`;
  link.href = elements.capturedImage.src;
  link.click();
  showToast('Photo saved to downloads', 'success');
}

async function sharePhoto() {
  try {
    const response = await fetch(elements.capturedImage.src);
    const blob = await response.blob();
    const file = new File([blob], `web-ar-menu-${Date.now()}.png`, { type: 'image/png' });
    
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'My AR Dish',
        text: 'Check out this dish in AR!',
        files: [file]
      });
      showToast('Shared successfully!', 'success');
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      showToast('Copied to clipboard!', 'success');
    }
  } catch (error) {
    console.error('Share error:', error);
    showToast('Could not share photo', 'error');
  }
}

function retakePhoto() {
  gsap.to(elements.capturePreview, {
    opacity: 0,
    scale: 0.9,
    duration: 0.2,
    onComplete: () => elements.capturePreview.classList.add('hidden')
  });
}

// ============================================
// AR MODE TOGGLE
// ============================================
function toggleARMode() {
  const modes = ['surface', 'marker', 'both'];
  const currentIndex = modes.indexOf(state.arMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  state.arMode = modes[nextIndex];
  
  // Update radio buttons
  elements.arModeRadios.forEach(radio => {
    radio.checked = radio.value === state.arMode;
  });
  
  // Apply mode
  applyARMode(state.arMode);
  
  showToast(`AR Mode: ${state.arMode}`, 'info');
}

function applyARMode(mode) {
  switch (mode) {
    case 'surface':
      elements.tableAnchor.setAttribute('visible', 'true');
      elements.hitPlane.setAttribute('visible', 'true');
      elements.hiroMarker.setAttribute('visible', 'false');
      elements.customMarker.setAttribute('visible', 'false');
      break;
    case 'marker':
      elements.tableAnchor.setAttribute('visible', 'false');
      elements.hitPlane.setAttribute('visible', 'false');
      elements.hiroMarker.setAttribute('visible', 'true');
      break;
    case 'both':
      elements.tableAnchor.setAttribute('visible', 'true');
      elements.hitPlane.setAttribute('visible', 'true');
      elements.hiroMarker.setAttribute('visible', 'true');
      break;
  }
}

// ============================================
// RESET AR
// ============================================
function resetAR() {
  // Hide model
  if (state.currentModel) {
    elements.foodModel.setAttribute('visible', 'false');
  }
  
  // Reset surface detection
  state.isSurfaceFound = false;
  elements.tableRing.setAttribute('visible', 'false');
  
  // Reset instructions
  gsap.set([elements.instructionSurface, elements.instructionTap, elements.instructionGesture], {
    opacity: 1,
    scale: 1
  });
  
  // Hide dish info
  hideDishInfoPanel();
  
  showToast('AR session reset', 'info');
}

// ============================================
// ORDER MANAGEMENT
// ============================================
function addToOrder() {
  if (!state.currentDish) return;
  
  const existingItem = state.order.find(item => item.dish._id === state.currentDish._id);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    state.order.push({
      dish: state.currentDish,
      quantity: 1,
      addedAt: new Date()
    });
  }
  
  updateOrderBadge();
  showToast(`${getText(state.currentDish, 'name')} added to order`, 'success');
  
  // Animate button
  gsap.fromTo(elements.btnAddToOrder,
    { scale: 1 },
    { scale: 1.2, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out' }
  );
}

function updateOrderBadge() {
  const totalItems = state.order.reduce((sum, item) => sum + item.quantity, 0);
  
  let badge = elements.btnAddToOrder.querySelector('.order-badge');
  if (totalItems > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'order-badge';
      elements.btnAddToOrder.appendChild(badge);
    }
    badge.textContent = totalItems;
  } else if (badge) {
    badge.remove();
  }
}

// ============================================
// SETTINGS HANDLERS
// ============================================
function setupSettingsHandlers() {
  // AR Mode radios
  elements.arModeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      state.arMode = radio.value;
      applyARMode(state.arMode);
    });
  });
  
  // Shadows toggle
  elements.settingShadows.addEventListener('change', () => {
    state.settings.shadows = elements.settingShadows.checked;
    elements.arSceneEl.renderer.shadowMap.enabled = state.settings.shadows;
    
    if (state.currentModel) {
      state.currentModel.traverse(child => {
        if (child.isMesh) {
          child.castShadow = state.settings.shadows;
          child.receiveShadow = state.settings.shadows;
        }
      });
    }
  });
  
  // Auto rotate toggle
  elements.settingAutoRotate.addEventListener('change', () => {
    state.settings.autoRotate = elements.settingAutoRotate.checked;
    if (state.settings.autoRotate && state.currentDish) {
      startModelAnimation(state.currentDish.model3D?.animation || CONFIG.defaultAnimation);
    } else {
      stopModelAnimations();
    }
  });
  
  // Show nutrition toggle
  elements.settingShowNutrition.addEventListener('change', () => {
    state.settings.showNutrition = elements.settingShowNutrition.checked;
    if (state.currentDish) {
      updateDishInfoPanel(state.currentDish);
    }
  });
  
  // Language selector
  elements.settingLanguage.addEventListener('change', () => {
    state.language = elements.settingLanguage.value;
    updateUILanguage();
  });
}

function updateUILanguage() {
  // Update all text elements based on language
  if (state.menuData) {
    elements.restaurantName.textContent = getText(state.restaurantData, 'name');
    elements.restaurantTagline.textContent = getText(state.restaurantData, 'description', 'AR Menu Experience');
    
    // Rebuild category selector and dishes list
    buildCategorySelector();
    if (state.currentCategory) {
      buildDishesList(state.currentCategory);
    }
  }
  
  if (state.currentDish) {
    updateDishInfoPanel(state.currentDish);
  }
  
  // Update document direction for RTL languages
  document.documentElement.dir = state.language === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = state.language;
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // Menu toggle
  elements.btnMenuToggle.addEventListener('click', openSideMenu);
  elements.btnCloseMenu.addEventListener('click', closeSideMenu);
  
  // Settings toggle
  elements.btnSettingsToggle.addEventListener('click', openSettingsPanel);
  elements.btnCloseSettings.addEventListener('click', closeSettingsPanel);
  
  // Bottom controls
  elements.btnResetAR.addEventListener('click', resetAR);
  elements.btnSwitchCamera.addEventListener('click', () => {}); // Handled in setupCameraControls
  elements.btnCapture.addEventListener('click', captureARPhoto);
  elements.btnToggleMarker.addEventListener('click', toggleARMode);
  elements.btnHelp.addEventListener('click', openHelpModal);
  
  // Dish info actions
  elements.btnViewDetails.addEventListener('click', () => {
    // Could open detailed view
    showToast('Detailed view coming soon', 'info');
  });
  elements.btnAddToOrder.addEventListener('click', addToOrder);
  
  // Capture preview
  elements.btnRetake.addEventListener('click', retakePhoto);
  elements.btnSavePhoto.addEventListener('click', savePhoto);
  elements.btnSharePhoto.addEventListener('click', sharePhoto);
  
  // Help modal
  elements.helpModal.querySelector('.modal-close').addEventListener('click', closeHelpModal);
  elements.helpModal.querySelector('.modal-backdrop').addEventListener('click', closeHelpModal);
  
  // Search
  elements.menuSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    filterDishes(query);
  });
  
  // Close panels on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSideMenu();
      closeSettingsPanel();
      closeHelpModal();
      hideDishInfoPanel();
    }
  });
  
  // Settings
  setupSettingsHandlers();
}

function filterDishes(query) {
  if (!state.currentCategory) return;
  
  const dishes = state.dishesByCategory[state.currentCategory] || [];
  const filtered = dishes.filter(dish => 
    getText(dish, 'name').toLowerCase().includes(query) ||
    getText(dish, 'description').toLowerCase().includes(query)
  );
  
  // Rebuild list with filtered dishes
  elements.dishesList.innerHTML = '';
  filtered.forEach((dish, index) => {
    const dishEl = document.createElement('div');
    dishEl.className = 'dish-item';
    dishEl.dataset.dishId = dish._id;
    dishEl.style.animationDelay = `${index * 50}ms`;
    dishEl.innerHTML = `
      <div class="dish-image">
        <img src="${dish.model3D?.thumbnail || ''}" alt="${getText(dish, 'name')}" loading="lazy">
        ${dish.isFeatured ? '<span class="featured-badge">⭐ Featured</span>' : ''}
      </div>
      <div class="dish-info">
        <h3 class="dish-title">${getText(dish, 'name')}</h3>
        <p class="dish-desc">${getText(dish, 'description', '')}</p>
        <div class="dish-footer">
          <span class="dish-price">${formatPrice(dish.price, dish.currency)}</span>
          <button class="btn-view-ar" data-dish-id="${dish._id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              <path d="M21 3l-6 6m2 5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            View in AR
          </button>
        </div>
      </div>
    `;
    
    dishEl.querySelector('.btn-view-ar').addEventListener('click', () => {
      loadDishModel(dish);
      closeSideMenu();
    });
    
    elements.dishesList.appendChild(dishEl);
  });
  
  if (filtered.length === 0) {
    elements.dishesList.innerHTML = '<p class="no-dishes">No dishes match your search</p>';
  }
}

// ============================================
// INITIALIZATION
// ============================================
async function init() {
  try {
    // Initialize DOM elements
    initDOMElements();
    
    // Setup event listeners
    setupEventListeners();
    
    // Fetch menu data
    await fetchMenuData();
    
    // Update restaurant branding
    if (state.restaurantData) {
      elements.restaurantLogo.src = state.restaurantData.logo || '';
      elements.restaurantName.textContent = getText(state.restaurantData, 'name');
      elements.restaurantTagline.textContent = getText(state.restaurantData, 'description', 'AR Menu Experience');
      
      // Apply restaurant colors
      document.documentElement.style.setProperty('--primary-color', state.restaurantData.primaryColor || '#1a1a2e');
      document.documentElement.style.setProperty('--accent-color', state.restaurantData.accentColor || '#e94560');
    }
    
    // Initialize AR scene
    await initARScene();
    
    // Set initial AR mode
    applyARMode(state.arMode);
    
    // Check for URL parameters (direct dish link)
    const urlParams = new URLSearchParams(window.location.search);
    const dishId = urlParams.get('dish');
    if (dishId) {
      const dishData = await fetchDishDetails(dishId);
      if (dishData.dish) {
        await loadDishModel(dishData.dish);
      }
    }
    
    console.log('WebAR Menu initialized successfully');
    
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Failed to initialize AR experience', 'error');
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
window.WebARMenu = {
  state,
  loadDishModel,
  showToast,
  resetAR
};