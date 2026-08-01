import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import menuRoutes from './routes/menu.js';
import uploadRoutes from './routes/upload.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
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
      workerSrc: ["'self'", "blob:"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Middleware
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1d',
  etag: true
}));

// API Routes
app.use('/api/menu', menuRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// AR Experience page (main AR viewer)
app.get('/ar/:menuId', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/ar/index.html'));
});

// Menu page (traditional menu view)
app.get('/menu/:restaurantSlug', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/menu/index.html'));
});

// Admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// QR Code redirect (for table markers)
app.get('/qr/:menuId', async (req, res) => {
  try {
    const { getMenuById } = await import('./models/Menu.js');
    const menu = await getMenuById(req.params.menuId);
    if (menu) {
      // Redirect to AR experience with menu ID
      res.redirect(`/ar/${menu.id}`);
    } else {
      res.status(404).send('Menu not found');
    }
  } catch (error) {
    res.status(500).send('Server error');
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 WebAR Menu server running on http://localhost:${PORT}`);
  console.log(`📱 AR Experience: http://localhost:${PORT}/ar/{menuId}`);
  console.log(`📋 Menu View: http://localhost:${PORT}/menu/{restaurantSlug}`);
  console.log(`⚙️  Admin Panel: http://localhost:${PORT}/admin`);
});

export default app;