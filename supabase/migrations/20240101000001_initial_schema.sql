-- WebAR Menu Database Schema for Supabase (PostgreSQL)
-- Run this in Supabase SQL Editor or via CLI: supabase db push
-- This version is idempotent - can be run multiple times safely

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- RESTAURANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255),
    description TEXT,
    description_ar TEXT,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url TEXT,
    cover_image_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#1a1a2e',
    secondary_color VARCHAR(7) DEFAULT '#16213e',
    accent_color VARCHAR(7) DEFAULT '#e94560',
    slug VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    is_published BOOLEAN DEFAULT false,
    social_links JSONB DEFAULT '{}',
    opening_hours JSONB DEFAULT '{}',
    ar_settings JSONB DEFAULT '{
        "defaultMarkerType": "surface",
        "tableMarkerImage": "",
        "qrCodeBaseUrl": ""
    }',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_published ON restaurants(is_published) WHERE is_published = true;

-- ============================================
-- MENUS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255),
    description TEXT,
    description_ar TEXT,
    language VARCHAR(10) DEFAULT 'en',
    rtl BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{
        "showPrices": true,
        "enableAR": true,
        "arMode": "markerless"
    }',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menus_restaurant ON menus(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menus_active ON menus(restaurant_id, is_active) WHERE is_active = true;

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100),
    description TEXT,
    icon VARCHAR(10),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_menu ON categories(menu_id);

-- ============================================
-- DISHES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255),
    description TEXT,
    description_ar TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    category VARCHAR(50) NOT NULL DEFAULT 'main',
    
    -- 3D Model Configuration
    model3d JSONB DEFAULT '{
        "url": "",
        "thumbnail": "",
        "scale": {"x": 1, "y": 1, "z": 1},
        "position": {"x": 0, "y": 0, "z": 0},
        "rotation": {"x": 0, "y": 0, "z": 0},
        "animation": "rotate"
    }',
    
    -- AR Configuration
    ar_config JSONB DEFAULT '{
        "markerType": "surface",
        "markerImage": "",
        "surfaceDetection": true,
        "anchorToTable": true,
        "allowScale": true,
        "allowRotation": true
    }',
    
    -- Nutritional Information
    nutrition JSONB DEFAULT '{
        "calories": null,
        "protein": null,
        "carbs": null,
        "fat": null,
        "allergens": [],
        "dietary": []
    }',
    
    -- Display Settings
    is_available BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    
    -- Analytics
    views INTEGER DEFAULT 0,
    ar_views INTEGER DEFAULT 0,
    orders INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dishes_menu ON dishes(menu_id);
CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(category);
CREATE INDEX IF NOT EXISTS idx_dishes_available ON dishes(menu_id, is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_dishes_featured ON dishes(menu_id, is_featured) WHERE is_featured = true;

-- ============================================
-- MENU STATS (Aggregated Analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS menu_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_views INTEGER DEFAULT 0,
    total_ar_views INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    popular_dishes JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(menu_id, date)
);

CREATE INDEX IF NOT EXISTS idx_menu_stats_menu_date ON menu_stats(menu_id, date DESC);

-- ============================================
-- ORDERS TABLE (Optional - for order tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(50),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    items JSONB NOT NULL DEFAULT '[]',
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_date ON orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ============================================
-- UPLOADS TABLE (Track 3D model uploads)
-- ============================================
CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    url TEXT NOT NULL,
    dish_id UUID REFERENCES dishes(id) ON DELETE SET NULL,
    uploaded_by UUID, -- Could reference auth.users
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploads_dish ON uploads(dish_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables (idempotent)
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Public read published restaurants" ON restaurants;
DROP POLICY IF EXISTS "Public read active menus" ON menus;
DROP POLICY IF EXISTS "Public read active categories" ON categories;
DROP POLICY IF EXISTS "Public read available dishes" ON dishes;
DROP POLICY IF EXISTS "Admin full access restaurants" ON restaurants;
DROP POLICY IF EXISTS "Admin full access menus" ON menus;
DROP POLICY IF EXISTS "Admin full access categories" ON categories;
DROP POLICY IF EXISTS "Admin full access dishes" ON dishes;
DROP POLICY IF EXISTS "Admin full access orders" ON orders;
DROP POLICY IF EXISTS "Admin full access uploads" ON uploads;

-- Public read access for published restaurants/menus
CREATE POLICY "Public read published restaurants" ON restaurants
    FOR SELECT USING (is_published = true);

CREATE POLICY "Public read active menus" ON menus
    FOR SELECT USING (is_active = true AND EXISTS (
        SELECT 1 FROM restaurants r WHERE r.id = menus.restaurant_id AND r.is_published = true
    ));

CREATE POLICY "Public read active categories" ON categories
    FOR SELECT USING (is_active = true AND EXISTS (
        SELECT 1 FROM menus m WHERE m.id = categories.menu_id AND m.is_active = true
    ));

CREATE POLICY "Public read available dishes" ON dishes
    FOR SELECT USING (is_available = true AND EXISTS (
        SELECT 1 FROM menus m WHERE m.id = dishes.menu_id AND m.is_active = true
    ));

-- Admin policies (using auth.jwt() role check)
CREATE POLICY "Admin full access restaurants" ON restaurants
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access menus" ON menus
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access categories" ON categories
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access dishes" ON dishes
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access orders" ON orders
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access uploads" ON uploads
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist, then recreate
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants;
DROP TRIGGER IF EXISTS update_menus_updated_at ON menus;
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS update_dishes_updated_at ON dishes;
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;

-- Apply updated_at triggers
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON menus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dishes_updated_at BEFORE UPDATE ON dishes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment dish views
CREATE OR REPLACE FUNCTION increment_dish_views(dish_uuid UUID, view_type TEXT)
RETURNS VOID AS $$
BEGIN
    IF view_type = 'ar' THEN
        UPDATE dishes SET ar_views = ar_views + 1 WHERE id = dish_uuid;
    ELSE
        UPDATE dishes SET views = views + 1 WHERE id = dish_uuid;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get menu with all relations (for AR view)
CREATE OR REPLACE FUNCTION get_menu_for_ar(menu_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', m.id,
        'name', m.name,
        'nameAr', m.name_ar,
        'description', m.description,
        'descriptionAr', m.description_ar,
        'settings', m.settings,
        'restaurant', jsonb_build_object(
            'id', r.id,
            'name', r.name,
            'nameAr', r.name_ar,
            'logo', r.logo_url,
            'primaryColor', r.primary_color,
            'accentColor', r.accent_color,
            'arSettings', r.ar_settings
        ),
        'categories', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'nameAr', c.name_ar,
                'icon', c.icon,
                'displayOrder', c.display_order
            ) ORDER BY c.display_order)
            FROM categories c WHERE c.menu_id = m.id AND c.is_active = true
        ),
        'dishes', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', d.id,
                'name', d.name,
                'nameAr', d.name_ar,
                'description', d.description,
                'descriptionAr', d.description_ar,
                'price', d.price,
                'currency', d.currency,
                'category', d.category,
                'model3D', d.model3d,
                'arConfig', d.ar_config,
                'nutrition', d.nutrition,
                'isAvailable', d.is_available,
                'isFeatured', d.is_featured,
                'displayOrder', d.display_order
            ) ORDER BY d.display_order)
            FROM dishes d WHERE d.menu_id = m.id AND d.is_available = true
        )
    ) INTO result
    FROM menus m
    JOIN restaurants r ON r.id = m.restaurant_id
    WHERE m.id = menu_uuid AND m.is_active = true;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to execute arbitrary SQL (for admin operations)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample restaurant (idempotent with ON CONFLICT)
INSERT INTO restaurants (name, name_ar, description, slug, is_published, primary_color, accent_color)
VALUES (
    'Firasse Food',
    'طعام فراس',
    'مطعم مع قائمة طعام بتقنية الواقع المعزز',
    'firasse_food',
    true,
    '#1a1a2e',
    '#e94560'
) ON CONFLICT (slug) DO NOTHING;

-- Get the restaurant ID for sample data
DO $$
DECLARE
    rest_id UUID;
    menu_id UUID;
BEGIN
    SELECT id INTO rest_id FROM restaurants WHERE slug = 'firasse_food';
    
    IF rest_id IS NOT NULL THEN
        INSERT INTO menus (restaurant_id, name, name_ar, is_active, published_at)
        VALUES (rest_id, 'Main Menu', 'القائمة الرئيسية', true, NOW())
        ON CONFLICT DO NOTHING
        RETURNING id INTO menu_id;
        
        -- If menu already exists, get its ID
        IF menu_id IS NULL THEN
            SELECT id INTO menu_id FROM menus WHERE restaurant_id = rest_id AND name = 'Main Menu' LIMIT 1;
        END IF;
        
        IF menu_id IS NOT NULL THEN
            INSERT INTO categories (menu_id, name, name_ar, icon, display_order) VALUES
            (menu_id, 'Appetizers', 'المقبلات', '🥗', 1),
            (menu_id, 'Main Courses', 'الأطباق الرئيسية', '🍖', 2),
            (menu_id, 'Desserts', 'الحلويات', '🍰', 3),
            (menu_id, 'Drinks', 'المشروبات', '🍷', 4)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END $$;