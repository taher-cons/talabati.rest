# WebAR Menu - Production Deployment Checklist

## ✅ Completed Tasks

### 1. Project Structure & Architecture
- [x] Monorepo structure with `web-ar-menu/` root
- [x] Separate `functions/` directory for Firebase Cloud Functions
- [x] Public frontend directories: `/ar`, `/menu`, `/admin`
- [x] Supabase database schema and migrations
- [x] Environment configuration files

### 2. Backend API (Firebase Functions)
- [x] Express.js server with TypeScript
- [x] Firebase Functions v2 configuration
- [x] Security middleware (Helmet, CORS, Rate Limiting)
- [x] Health check endpoint
- [x] Menu API routes (CRUD for restaurants, menus, dishes, categories)
- [x] Upload API routes (images, 3D models, thumbnails, markers)
- [x] Auth API routes (signup, login, logout, password reset, user management)
- [x] Supabase integration (PostgreSQL + Storage)
- [x] TypeScript configuration

### 3. Frontend - AR Experience (`/public/ar`)
- [x] AR viewer with Three.js + WebXR
- [x] Marker-based AR (Hiro marker + custom markers)
- [x] GLTF/GLB model loading with animations
- [x] Touch/mouse interaction (rotate, scale, position)
- [x] AR session management
- [x] Loading states and error handling
- [x] Responsive design for mobile
- [x] RTL Arabic support

### 4. Frontend - Menu View (`/public/menu`)
- [x] Restaurant menu display
- [x] Category filtering
- [x] Dish cards with AR launch button
- [x] Search functionality
- [x] Featured dishes section
- [x] RTL Arabic support
- [x] Responsive grid layout

### 5. Frontend - Admin Panel (`/public/admin`)
- [x] Authentication (login, logout, session management)
- [x] Dashboard with analytics
- [x] Restaurant management
- [x] Menu builder (drag & drop categories/dishes)
- [x] Dish editor with 3D model upload
- [x] Image upload with preview
- [x] QR code generation for AR links
- [x] User management (roles: owner, admin, manager, staff)
- [x] Settings panel

### 6. Database (Supabase/PostgreSQL)
- [x] Restaurants table
- [x] Menus table
- [x] Categories table
- [x] Dishes table (with AR config: model_url, scale, position, rotation, marker_image)
- [x] User profiles table (with roles)
- [x] Menu stats table (analytics)
- [x] Row Level Security (RLS) policies
- [x] Storage buckets: logos, models, thumbnails, markers, qr-codes
- [x] Storage policies for public/private access

### 7. DevOps & Deployment
- [x] Firebase configuration (`firebase.json`, `.firebaserc`)
- [x] GitHub Actions CI/CD pipeline
- [x] Production environment variables template
- [x] TypeScript build for functions
- [x] ESLint/Prettier configuration

---

## 🔄 In Progress / Pending

### 8. Supabase Setup (Run in Supabase Dashboard)
- [ ] Execute migration: `supabase/migrations/20240101000001_initial_schema.sql`
- [ ] Execute RLS fix: `supabase/fix_rls.sql`
- [ ] Create storage buckets: `logos`, `models`, `thumbnails`, `markers`, `qr-codes`
- [ ] Apply storage policies: `supabase/storage_policies.sql`
- [ ] Enable Email/Password auth in Supabase Auth
- [ ] Configure SMTP for password reset emails

### 9. Firebase Setup
- [ ] Create Firebase project: `talabati-rest`
- [ ] Enable Firebase Hosting
- [ ] Enable Cloud Functions (Node.js 20)
- [ ] Add custom domain: `talabati.rest`
- [ ] Configure Firebase Secrets for environment variables

### 10. Domain & SSL
- [ ] Purchase/configure `talabati.rest` domain
- [ ] Add DNS records for Firebase Hosting
- [ ] Verify SSL certificate provisioning

### 11. Testing & QA
- [ ] Test AR experience on iOS Safari (WebXR)
- [ ] Test AR experience on Android Chrome (WebXR)
- [ ] Test marker-based AR with printed Hiro marker
- [ ] Test custom marker detection
- [ ] Test admin panel CRUD operations
- [ ] Test file uploads (images, 3D models)
- [ ] Test authentication flow
- [ ] Load test API endpoints
- [ ] Cross-browser testing

### 12. Performance Optimization
- [ ] Enable gzip/brotli compression
- [ ] Configure CDN caching headers
- [ ] Optimize 3D model file sizes (GLTF compression)
- [ ] Implement lazy loading for menu images
- [ ] Add service worker for offline support
- [ ] Configure Firebase Functions min instances

### 13. Monitoring & Analytics
- [ ] Set up Sentry error tracking
- [ ] Configure Google Analytics 4
- [ ] Set up Firebase Performance Monitoring
- [ ] Configure uptime monitoring
- [ ] Set up alerting for API errors

---

## 📋 Pre-Launch Verification

### Environment Variables (Set in Firebase Functions Config)
```bash
firebase functions:config:set \
  supabase.url="https://hgyhkeuylgqrdtptahru.supabase.co" \
  supabase.anon_key="<REDACTED_ROTATED_KEY>" \
  supabase.service_role_key="<REDACTED_ROTATED_KEY>" \
  client_url="https://talabati.rest" \
  jwt_secret="your-generated-secret" \
  session_secret="your-generated-secret"
```

### Supabase Secrets (Set in Supabase Dashboard)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### GitHub Secrets (For CI/CD)
- `FIREBASE_SERVICE_ACCOUNT`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 🚀 Deployment Commands

### Local Development
```bash
# Install dependencies
cd web-ar-menu && npm install
cd functions && npm install

# Start dev server
npm run dev

# Start Firebase emulators
firebase emulators:start
```

### Deploy to Staging
```bash
# Build functions
cd functions && npm run build

# Deploy to Firebase staging channel
firebase hosting:channel:deploy staging
```

### Deploy to Production
```bash
# Build everything
cd web-ar-menu && npm run build
cd functions && npm run build

# Deploy to Firebase
firebase deploy
```

---

## 📱 AR Experience Testing Checklist

### Marker-Based AR (Hiro Marker)
- [ ] Print Hiro marker at 100% scale (8cm x 8cm)
- [ ] Test on iOS Safari (iOS 13+)
- [ ] Test on Android Chrome (Android 8+)
- [ ] Verify model loads and tracks correctly
- [ ] Test touch interactions (rotate, scale, move)
- [ ] Test lighting estimation

### Custom Marker AR
- [ ] Upload custom marker image in admin
- [ ] Print custom marker
- [ ] Test detection reliability
- [ ] Verify model alignment

### WebXR Session
- [ ] Test "Enter AR" button
- [ ] Test hit-testing (place on surface)
- [ ] Test session end/resume
- [ ] Test permissions handling

---

## 🔐 Security Checklist

- [ ] All API routes have rate limiting
- [ ] Helmet.js security headers configured
- [ ] CORS restricted to production domain
- [ ] Supabase RLS policies enforced
- [ ] Service role key only in server environment
- [ ] JWT secrets rotated for production
- [ ] File upload validation (type, size)
- [ ] Admin routes protected by role checks
- [ ] HTTPS enforced everywhere
- [ ] Content Security Policy configured

---

## 📊 Post-Launch Monitoring

- [ ] Monitor API response times (< 200ms p95)
- [ ] Monitor AR session success rate (> 90%)
- [ ] Monitor 3D model load times (< 3s)
- [ ] Track user engagement (AR views, menu views)
- [ ] Monitor error rates (< 1%)
- [ ] Set up weekly performance reviews

---

## 📞 Support Contacts

- **Firebase Console**: https://console.firebase.google.com/project/talabati-rest
- **Supabase Dashboard**: https://supabase.com/dashboard/project/hgyhkeuylgqrdtptahru
- **GitHub Repo**: https://github.com/your-org/web-ar-menu
- **Domain DNS**: Your domain registrar

---

*Last Updated: 2024-01-28*
*Version: 1.0.0*