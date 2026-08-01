/**
 * 3D / AR dish viewer.
 *
 * Flow: /view?dish=<dishId>[&r=<restaurantSlug>]
 *   1. fetch the dish
 *   2. point <model-viewer> at its GLB
 *   3. let the platform handle AR (Scene Viewer on Android, Quick Look on iOS)
 *
 * Design rule for this page: the customer must ALWAYS end up with something
 * meaningful on screen — a rotating 3D dish, or a clear message telling them
 * what to do next. Never a blank screen and never an endless spinner (which is
 * exactly what the previous /ar page did).
 */

const API_BASE = '/api/menu';

const el = {
  viewer: document.getElementById('viewer'),
  state: document.getElementById('state'),
  stateText: document.getElementById('state-text'),
  stateAction: document.getElementById('state-action'),
  spinner: document.querySelector('.spinner'),
  progressFill: document.getElementById('progress-fill'),
  sheet: document.getElementById('sheet'),
  name: document.getElementById('dish-name'),
  price: document.getElementById('dish-price'),
  desc: document.getElementById('dish-desc'),
  hint: document.getElementById('hint'),
  btnAdd: document.getElementById('btn-add'),
  btnMenu: document.getElementById('btn-menu'),
  backLink: document.getElementById('back-link'),
  barTitle: document.getElementById('bar-title'),
  toasts: document.getElementById('toasts'),
};

/** Shared with /menu so the basket survives navigation between pages. */
const ORDER_KEY = 'talabati.order.v1';

// ============================================
// helpers
// ============================================
function toast(message, type = 'info', ms = 3200) {
  const node = document.createElement('div');
  node.className = `toast toast-${type}`;
  node.textContent = message;
  el.toasts.appendChild(node);
  setTimeout(() => node.remove(), ms);
}

function formatPrice(value, currency = 'DZD') {
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat('ar-DZ', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Guards against malformed currency codes stored by the dashboard.
    return `${amount} ${currency}`;
  }
}

/** Prefers Arabic content: the pilot restaurant and its customers are Algerian. */
function arabicFirst(dish, field) {
  const ar = dish[`${field}Ar`];
  return (ar && String(ar).trim()) || dish[field] || '';
}

function showState(text, { spinner = false, action = false } = {}) {
  el.stateText.textContent = text;
  el.spinner.hidden = !spinner;
  el.stateAction.hidden = !action;
  el.state.hidden = false;
}

function hideState() {
  el.state.hidden = true;
}

// ============================================
// order basket (shared with /menu via localStorage)
// ============================================
function readOrder() {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt/unavailable storage (private mode) must not break the page.
    return [];
  }
}

function addToOrder(dish) {
  const order = readOrder();
  const existing = order.find((item) => item.id === dish._id);

  if (existing) {
    existing.quantity += 1;
  } else {
    order.push({
      id: dish._id,
      name: arabicFirst(dish, 'name'),
      price: Number(dish.price) || 0,
      currency: dish.currency || 'DZD',
      image: dish.model3D?.thumbnail || dish.image || '',
      quantity: 1,
    });
  }

  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    const count = order.reduce((sum, item) => sum + item.quantity, 0);
    toast(`أُضيف إلى طلبك (${count})`, 'success');
  } catch {
    toast('تعذّر حفظ الطلب على هذا الجهاز', 'error');
  }
}

// ============================================
// main
// ============================================
async function init() {
  const params = new URLSearchParams(location.search);
  const dishId = params.get('dish');
  const slug = params.get('r');

  const menuHref = slug ? `/menu/${encodeURIComponent(slug)}` : '/menu';
  el.backLink.href = menuHref;
  el.btnMenu.href = menuHref;
  el.stateAction.href = menuHref;

  if (!dishId) {
    // Reaching /view without a dish is a broken link, not an app failure.
    showState('لم يُحدَّد طبق للعرض. اختر طبقاً من القائمة أولاً.', { action: true });
    return;
  }

  showState('جارٍ تحضير الطبق…', { spinner: true });

  let dish;
  try {
    const response = await fetch(`${API_BASE}/dish/${encodeURIComponent(dishId)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    dish = payload.dish || payload;
  } catch (error) {
    console.error('[view] failed to fetch dish:', error);
    showState('تعذّر تحميل بيانات الطبق. تحقّق من الاتصال وحاول مرة أخرى.', { action: true });
    return;
  }

  // ---- text content (shown even if the 3D model fails) ----
  const name = arabicFirst(dish, 'name');
  document.title = `${name} | طلباتي`;
  el.barTitle.textContent = name;
  el.name.textContent = name;
  el.price.textContent = formatPrice(dish.price, dish.currency);
  el.desc.textContent = arabicFirst(dish, 'description');
  el.sheet.hidden = false;

  el.btnAdd.addEventListener('click', () => addToOrder(dish));

  // ---- 3D model ----
  const modelUrl = dish.model3D?.url;
  if (!modelUrl) {
    showState(
      'هذا الطبق لا يحتوي مجسّماً ثلاثي الأبعاد بعد. يمكنك مشاهدة صورته وتفاصيله في القائمة.',
      { action: true }
    );
    return;
  }

  const poster = dish.model3D?.thumbnail || dish.image || '';
  if (poster) el.viewer.setAttribute('poster', poster);
  el.viewer.setAttribute('alt', `مجسّم ثلاثي الأبعاد لطبق ${name}`);
  el.viewer.setAttribute('src', modelUrl);

  // Image-to-3D tools (Stable Fast 3D, etc.) frequently export a model that
  // is upright / edge-on instead of lying flat as a dish sits on a table.
  // Rather than re-exporting from Blender every time, the admin panel lets
  // staff dial in a per-dish correction angle (model3D.rotation) which we
  // apply here via model-viewer's `orientation` attribute.
  const rotation = dish.model3D?.rotation;
  if (rotation && (rotation.x || rotation.y || rotation.z)) {
    el.viewer.setAttribute(
      'orientation',
      `${rotation.x || 0}deg ${rotation.y || 0}deg ${rotation.z || 0}deg`
    );
  }
  el.viewer.hidden = false;

  el.viewer.addEventListener('progress', (event) => {
    const pct = Math.round((event.detail?.totalProgress || 0) * 100);
    el.progressFill.style.width = `${pct}%`;
  });

  el.viewer.addEventListener('load', () => {
    hideState();
    normalizeScale();
    frameDishFromAbove();
    // Tell iOS users the truth instead of leaving them hunting for a button:
    // placing the dish on a real table needs ARCore (Android) or a USDZ file,
    // which this dish does not have yet.
    if (!el.viewer.canActivateAR) {
      el.hint.textContent =
        'اسحب بإصبعك لتدوير الطبق · باعد إصبعيك للتكبير — وضع الطاولة متاح على هواتف أندرويد المدعومة';
    }
  }, { once: true });

  el.viewer.addEventListener('error', (event) => {
    console.error('[view] model failed to load:', event);
    showState('تعذّر تحميل المجسّم ثلاثي الأبعاد. تفاصيل الطبق معروضة أدناه.', { action: true });
  }, { once: true });

  /**
   * Restaurants export models from all sorts of tools at all sorts of scales —
   * the pilot pizza is authored 0.92 m wide, i.e. a metre-wide pizza. With
   * `ar-scale="fixed"` that lands on the customer's table at its authored size
   * and looks absurd. Rescale anything outside a plausible plate range down to
   * a realistic diameter, so the AR placement is believable.
   */
  function normalizeScale() {
    const REALISTIC_MAX_M = 0.34; // a large pizza / serving plate
    const PLAUSIBLE_MIN_M = 0.10;
    const PLAUSIBLE_MAX_M = 0.45;

    // Admin-configurable size multiplier (model3D.scale). Defaults to 1×1×1
    // so dishes nobody has tuned yet behave exactly as before.
    const adminScale = dish.model3D?.scale || {};
    const mult = {
      x: Number(adminScale.x) || 1,
      y: Number(adminScale.y) || 1,
      z: Number(adminScale.z) || 1,
    };
    const hasAdminMultiplier = mult.x !== 1 || mult.y !== 1 || mult.z !== 1;

    const dims = el.viewer.getDimensions?.();
    if (!dims) {
      if (hasAdminMultiplier) el.viewer.scale = `${mult.x} ${mult.y} ${mult.z}`;
      return;
    }

    const widest = Math.max(dims.x, dims.z);
    let factor = 1;
    if (widest && (widest < PLAUSIBLE_MIN_M || widest > PLAUSIBLE_MAX_M)) {
      factor = REALISTIC_MAX_M / widest;
      console.info(
        `[view] model authored at ${widest.toFixed(2)} m wide — rescaled by ${factor.toFixed(3)} to ${REALISTIC_MAX_M} m for believable AR placement`
      );
    }

    if (factor !== 1 || hasAdminMultiplier) {
      el.viewer.scale = `${factor * mult.x} ${factor * mult.y} ${factor * mult.z}`;
    }
  }

  /**
   * The dish's texture is painted on its TOP surface. model-viewer's default
   * orbit (75° polar) looks almost edge-on, which showed nothing but the pale
   * side of the dough — the "white blob" seen on the pilot phone. Frame the
   * dish from above, and re-apply the framing after the model's real bounds are
   * known so it is never cropped.
   */
  function frameDishFromAbove() {
    el.viewer.cameraOrbit = '0deg 50deg 115%';
    el.viewer.fieldOfView = '32deg';
    el.viewer.jumpCameraToGoal?.();
  }

  // A model that never fires `load` (dead connection, huge file) must not leave
  // the customer staring at a spinner forever.
  setTimeout(() => {
    if (!el.state.hidden && el.spinner.hidden === false) {
      showState('التحميل يستغرق وقتاً أطول من المعتاد… تحقّق من قوة الشبكة.', { spinner: true });
    }
  }, 12000);
}

init();
