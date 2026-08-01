-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read models" ON storage.objects;
DROP POLICY IF EXISTS "Public read thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Public read markers" ON storage.objects;
DROP POLICY IF EXISTS "Public read logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert models" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert markers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update own models" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update own markers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update own logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own models" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own markers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own logos" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access models" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access markers" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access logos" ON storage.objects;

-- Public read access for all buckets
CREATE POLICY "Public read models" ON storage.objects
    FOR SELECT USING (bucket_id = 'models');

CREATE POLICY "Public read thumbnails" ON storage.objects
    FOR SELECT USING (bucket_id = 'thumbnails');

CREATE POLICY "Public read markers" ON storage.objects
    FOR SELECT USING (bucket_id = 'markers');

CREATE POLICY "Public read logos" ON storage.objects
    FOR SELECT USING (bucket_id = 'logos');

-- Authenticated users can upload
CREATE POLICY "Authenticated insert models" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'models' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert thumbnails" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'thumbnails' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert markers" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'markers' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated insert logos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- Users can update/delete their own files
CREATE POLICY "Authenticated update own models" ON storage.objects
    FOR UPDATE USING (bucket_id = 'models' AND auth.uid() = owner);

CREATE POLICY "Authenticated update own thumbnails" ON storage.objects
    FOR UPDATE USING (bucket_id = 'thumbnails' AND auth.uid() = owner);

CREATE POLICY "Authenticated update own markers" ON storage.objects
    FOR UPDATE USING (bucket_id = 'markers' AND auth.uid() = owner);

CREATE POLICY "Authenticated update own logos" ON storage.objects
    FOR UPDATE USING (bucket_id = 'logos' AND auth.uid() = owner);

CREATE POLICY "Authenticated delete own models" ON storage.objects
    FOR DELETE USING (bucket_id = 'models' AND auth.uid() = owner);

CREATE POLICY "Authenticated delete own thumbnails" ON storage.objects
    FOR DELETE USING (bucket_id = 'thumbnails' AND auth.uid() = owner);

CREATE POLICY "Authenticated delete own markers" ON storage.objects
    FOR DELETE USING (bucket_id = 'markers' AND auth.uid() = owner);

CREATE POLICY "Authenticated delete own logos" ON storage.objects
    FOR DELETE USING (bucket_id = 'logos' AND auth.uid() = owner);

-- Service role (admin) full access to all buckets
CREATE POLICY "Service role full access models" ON storage.objects
    FOR ALL USING (bucket_id = 'models' AND auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access thumbnails" ON storage.objects
    FOR ALL USING (bucket_id = 'thumbnails' AND auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access markers" ON storage.objects
    FOR ALL USING (bucket_id = 'markers' AND auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access logos" ON storage.objects
    FOR ALL USING (bucket_id = 'logos' AND auth.jwt() ->> 'role' = 'service_role');