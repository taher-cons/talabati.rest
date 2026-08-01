import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, uploadFile, deleteFile } from '../supabase.js';

const router = express.Router();

// Configure multer for memory storage (for Supabase upload)
const storage = multer.memoryStorage();

// File filter for 3D models and images
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'model/gltf-binary',
    'model/gltf+json',
    'application/octet-stream', // .glb files
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml'
  ];
  
  const allowedExtensions = ['.glb', '.gltf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only GLB, GLTF, and image files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10
  }
});

// Upload 3D model to Supabase Storage
router.post('/model', upload.single('model'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filename = `${uuidv4()}${req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf('.'))}`;
    const path = `models/${filename}`;
    
    const result = await uploadFile('models', path, req.file.buffer, req.file.mimetype);
    
    res.json({
      success: true,
      file: {
        filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: result.publicUrl,
        path: result.path
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload multiple files (model + thumbnail)
router.post('/model-set', upload.fields([
  { name: 'model', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files;
    const result = {};
    
    if (files.model) {
      const modelFile = files.model[0];
      const filename = `${uuidv4()}${modelFile.originalname.toLowerCase().substring(modelFile.originalname.lastIndexOf('.'))}`;
      const path = `models/${filename}`;
      
      const uploadResult = await uploadFile('models', path, modelFile.buffer, modelFile.mimetype);
      
      result.model = {
        filename,
        originalName: modelFile.originalname,
        size: modelFile.size,
        url: uploadResult.publicUrl,
        path: uploadResult.path
      };
    }
    
    if (files.thumbnail) {
      const thumbFile = files.thumbnail[0];
      const filename = `${uuidv4()}${thumbFile.originalname.toLowerCase().substring(thumbFile.originalname.lastIndexOf('.'))}`;
      const path = `thumbnails/${filename}`;
      
      const uploadResult = await uploadFile('thumbnails', path, thumbFile.buffer, thumbFile.mimetype);
      
      result.thumbnail = {
        filename,
        originalName: thumbFile.originalname,
        size: thumbFile.size,
        url: uploadResult.publicUrl,
        path: uploadResult.path
      };
    }
    
    res.json({ success: true, files: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload image (for markers, logos, etc.)
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const filename = `${uuidv4()}${req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf('.'))}`;
    const bucket = req.body.bucket || 'logos';
    const path = `${bucket}/${filename}`;
    
    const result = await uploadFile(bucket, path, req.file.buffer, req.file.mimetype);
    
    res.json({
      success: true,
      image: {
        filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: result.publicUrl,
        path: result.path
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete uploaded file
router.delete('/:bucket/:path(*)', async (req, res) => {
  try {
    const { bucket, path } = req.params;
    await deleteFile(bucket, path);
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get upload info
router.get('/info', (req, res) => {
  res.json({
    maxFileSize: '50MB',
    allowedTypes: {
      models: ['.glb', '.gltf'],
      images: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']
    },
    endpoints: {
      model: 'POST /api/upload/model',
      modelSet: 'POST /api/upload/model-set',
      image: 'POST /api/upload/image',
      delete: 'DELETE /api/upload/:bucket/:path'
    }
  });
});

export default router;