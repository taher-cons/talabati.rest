import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

dotenv.config();

setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 60,
});

const app = express();

// Trust proxy for rate limiting behind Cloud Run/Load Balancer
// Use '1' to trust only the first proxy (Cloud Run's load balancer)
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ============================================================
// Request ID + structured logging
// Cloud Logging groups by `trace`; a per-request id lets us correlate a user
// report ("I got an error") with the exact log line and error response.
// ============================================================
app.use((req, res, next) => {
  req.requestId =
    req.get('x-request-id') ||
    req.get('function-execution-id') ||
    crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});

morgan.token('id', (req) => req.requestId);
app.use(
  morgan(':id :method :url :status :res[content-length] - :response-time ms', {
    // Health checks are polled constantly; keep the logs readable.
    skip: (req) => req.path === '/api/health' && req.method === 'GET',
  })
);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdn.aframe.io"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "blob:", "https:"],
      connectSrc: ["'self'", "https:", "wss:", "blob:", "data:"],
      frameSrc: ["'self'", "https:"],
      workerSrc: ["'self'", "blob:"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrcAttr: ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // 3D models are fetched cross-origin
}));

// ============================================================
// Rate Limiting
// ============================================================
const keyByIp = (req) => req.ip;

// Public read API (menus, dishes, QR): generous, a busy restaurant hits this a lot.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIp,
});

// Admin/uploads: mutating, expensive, service-role backed.
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests on this endpoint, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIp,
});

// Credential endpoints: brute-force / password-spray protection.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: keyByIp,
});

app.use('/api/', generalLimiter);
app.use('/api/menu/admin', strictLimiter);
app.use('/api/upload', strictLimiter);
app.use('/api/auth/admin', strictLimiter);
app.post('/api/auth/login', authLimiter);
app.post('/api/auth/signup', authLimiter);
app.post('/api/auth/reset-password', authLimiter);
app.post('/api/auth/update-password', authLimiter);
app.post('/api/auth/refresh', authLimiter);

app.use(compression());

// ============================================================
// CORS — explicit allowlist instead of a single CLIENT_URL.
// The previous single-origin config broke www./firebaseapp.com variants and
// silently blocked the admin panel when CLIENT_URL didn't match exactly.
// ============================================================
const allowedOrigins = new Set(
  [
    process.env.CLIENT_URL,
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
    'https://talabati.rest',
    'https://www.talabati.rest',
    'https://talabati-946bb.web.app',
    'https://talabati-946bb.firebaseapp.com',
    ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
      : []),
  ]
    .map((o) => (o || '').trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header => same-origin navigation, curl, QR scan. Allow.
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      console.warn(`[cors] blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 86400,
  })
);

app.use(express.json({ limit: '10mb' })); // JSON bodies are metadata only; files go through multer
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// Health & readiness
// ============================================================
app.get('/api/health', async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: 'ok',
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    config: {
      supabaseUrl: Boolean(process.env.SUPABASE_URL),
      supabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
      supabaseServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      adminApiKey: Boolean(process.env.ADMIN_API_KEY),
    },
    deps: {
      supabase: { status: 'unknown' },
      storage: { status: 'unknown' }
    }
  };

  let supabaseAdminClient;
  try {
    const supabaseModule = await import('./supabase.js');
    const admin = supabaseModule.getSupabaseAdmin();
    supabaseAdminClient = admin;

    // Check database connectivity
    const start = Date.now();
    const { error } = await admin.from('restaurants').select('id', { count: 'exact', head: true });
    health.deps.supabase = {
      status: error ? 'error' : 'ok',
      latency: Date.now() - start,
      error: error ? error.message : null
    };
  } catch (e) {
    health.deps.supabase = { status: 'error', error: e.message };
  }

  // Check Supabase Storage
  try {
    if (supabaseAdminClient) {
      const start = Date.now();
      const { data: buckets, error: storageError } = await supabaseAdminClient.storage.listBuckets();
      health.deps.storage = {
        status: storageError ? 'error' : 'ok',
        latency: Date.now() - start,
        error: storageError ? storageError.message : null,
        buckets: buckets ? buckets.length : 0
      };
    }
  } catch (e) {
    health.deps.storage = { status: 'error', error: e.message };
  }

  health.responseTime = Date.now() - startTime;

  // Return a non-200 when degraded so uptime checks actually alert.
  if (health.deps.supabase.status === 'error') {
    health.status = 'degraded';
    return res.status(503).json(health);
  }

  return res.json(health);
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!', requestId: req.requestId });
});

// ============================================================
// Route loading (lazy, keeps cold starts small)
// ============================================================
let routesPromise = null;
let menuRoutes, uploadRoutes, authRoutes;

function loadRoutes() {
  if (!routesPromise) {
    routesPromise = Promise.all([
      import('./routes/menu.js'),
      import('./routes/upload.js'),
      import('./routes/auth.js'),
    ])
      .then(([menuModule, uploadModule, authModule]) => {
        menuRoutes = menuModule.default;
        uploadRoutes = uploadModule.default;
        authRoutes = authModule.default;
      })
      .catch((err) => {
        // Reset so the next request retries instead of failing forever.
        routesPromise = null;
        throw err;
      });
  }
  return routesPromise;
}

/** Wraps lazy loading so a module-load failure hits the error handler (not an unhandled rejection). */
const lazyRouter = (getRouter) => async (req, res, next) => {
  try {
    await loadRoutes();
    return getRouter()(req, res, next);
  } catch (err) {
    return next(err);
  }
};

// Versioned paths (/api/v1/**) are the contract going forward; the unversioned
// paths stay as aliases because deployed QR codes and the admin panel use them.
app.use(['/api/menu', '/api/v1/menu'], lazyRouter(() => menuRoutes));
app.use(['/api/upload', '/api/v1/upload'], lazyRouter(() => uploadRoutes));
app.use(['/api/auth', '/api/v1/auth'], lazyRouter(() => authRoutes));

// ============================================================
// 404 + error handling
// ============================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path, requestId: req.requestId });
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;

  console.error(
    JSON.stringify({
      severity: status >= 500 ? 'ERROR' : 'WARNING',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      message: err.message,
      stack: err.stack,
    })
  );

  // Multer / body-parser surface client mistakes; don't report them as 500s.
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (max 50MB)', requestId: req.requestId });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large', requestId: req.requestId });
  }

  return res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
    requestId: req.requestId,
  });
});

export const api = onRequest(
  {
    secrets: [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ADMIN_API_KEY',
    ],
    cors: false, // handled by the cors middleware above (with an allowlist)
  },
  app
);
