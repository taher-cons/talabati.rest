import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// SECURITY: uploads/deletes use the service-role key. Without this guard anyone
// could fill the storage buckets (cost abuse) or delete every 3D model.
// `signed-url` is included on purpose: it can mint URLs for private objects.
router.use(requireAdmin);


// Lazy initialization of Supabase client
let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }
    
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

/**
 * Strips directory components and unsafe characters from a client-supplied
 * filename. Prevents `../` path traversal into other storage prefixes and
 * avoids broken object keys from Arabic/space/unicode names.
 */
function sanitizeFileName(name = 'file') {
  const base = String(name).replace(/\\/g, '/').split('/').pop() || 'file';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+/, '')
    .slice(-100);
  return cleaned || 'file';
}

// Configure multer for memory storage (files will be uploaded to Supabase Storage)

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow images, 3D models, and common web formats
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
      'model/gltf-binary',
      'model/gltf+json',
      'application/octet-stream', // for .glb files
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  },
});

// Helper: Upload file to Supabase Storage
async function uploadToStorage(bucket, filePath, fileBuffer, contentType) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}

// POST /api/upload/image - Upload restaurant logo, dish thumbnail, etc.
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const allowedBuckets = ['models', 'thumbnails', 'markers', 'logos'];
    const bucket = req.body.bucket || 'logos';
    if (!allowedBuckets.includes(bucket)) {
      return res.status(400).json({ error: 'Invalid bucket' });
    }
    const fileName = `${uuidv4()}-${sanitizeFileName(req.file.originalname)}`;
    const filePath = `${Date.now()}/${fileName}`;


    const result = await uploadToStorage(bucket, filePath, req.file.buffer, req.file.mimetype);

    res.json({
      success: true,
      file: {
        path: result.path,
        url: result.url,
        bucket,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/upload/model-set - Upload 3D model + thumbnail + marker image
router.post('/model-set', upload.fields([
  { name: 'model', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'image', maxCount: 1 }, // marker image
]), async (req, res) => {
  try {
    const files = req.files;
    const results = {};

    // Upload 3D model
    if (files.model?.[0]) {
      const modelFile = files.model[0];
      const fileName = `${uuidv4()}-${sanitizeFileName(modelFile.originalname)}`;

      const filePath = `models/${Date.now()}/${fileName}`;
      
      const result = await uploadToStorage('models', filePath, modelFile.buffer, modelFile.mimetype);
      results.model = {
        path: result.path,
        url: result.url,
        originalName: modelFile.originalname,
        size: modelFile.size,
        mimetype: modelFile.mimetype,
      };
    }

    // Upload thumbnail
    if (files.thumbnail?.[0]) {
      const thumbFile = files.thumbnail[0];
      const fileName = `${uuidv4()}-${sanitizeFileName(thumbFile.originalname)}`;

      const filePath = `thumbnails/${Date.now()}/${fileName}`;
      
      const result = await uploadToStorage('thumbnails', filePath, thumbFile.buffer, thumbFile.mimetype);
      results.thumbnail = {
        path: result.path,
        url: result.url,
        originalName: thumbFile.originalname,
        size: thumbFile.size,
        mimetype: thumbFile.mimetype,
      };
    }

    // Upload marker image
    if (files.image?.[0]) {
      const markerFile = files.image[0];
      const fileName = `${uuidv4()}-${sanitizeFileName(markerFile.originalname)}`;

      const filePath = `markers/${Date.now()}/${fileName}`;
      
      const result = await uploadToStorage('markers', filePath, markerFile.buffer, markerFile.mimetype);
      results.image = {
        path: result.path,
        url: result.url,
        originalName: markerFile.originalname,
        size: markerFile.size,
        mimetype: markerFile.mimetype,
      };
    }

    res.json({
      success: true,
      files: results,
    });
  } catch (error) {
    console.error('Model set upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/upload/model - Upload single 3D model
router.post('/model', upload.single('model'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No model file provided' });
    }

    const fileName = `${uuidv4()}-${sanitizeFileName(req.file.originalname)}`;
    const filePath = `models/${Date.now()}/${fileName}`;

    const result = await uploadToStorage('models', filePath, req.file.buffer, req.file.mimetype);


    res.json({
      success: true,
      file: {
        path: result.path,
        url: result.url,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('Model upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/upload/:bucket/:path - Delete file from storage
router.delete('/:bucket/:path(*)', async (req, res) => {
  try {
    const { bucket, path } = req.params;
    
    // Validate bucket name
    const allowedBuckets = ['models', 'thumbnails', 'markers', 'logos'];
    if (!allowedBuckets.includes(bucket)) {
      return res.status(400).json({ error: 'Invalid bucket' });
    }
    if (path.includes('..')) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const supabase = getSupabase();
    const { error } = await supabase.storage

      .from(bucket)
      .remove([path]);

    if (error) throw error;

    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/upload/signed-url/:bucket/:path - Get signed URL for private files
router.get('/signed-url/:bucket/:path(*)', async (req, res) => {
  try {
    const { bucket, path } = req.params;
    const expiresIn = parseInt(req.query.expiresIn) || 3600; // 1 hour default

    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;

    res.json({ signedUrl: data.signedUrl, expiresIn });
  } catch (error) {
    console.error('Signed URL error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
