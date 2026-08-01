const mongoose = require('mongoose');

const dishSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  nameAr: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  descriptionAr: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  category: {
    type: String,
    required: true,
    enum: ['appetizer', 'main', 'dessert', 'drink', 'special']
  },
  // 3D Model configuration
  model3D: {
    url: String,           // .glb or .gltf file URL
    thumbnail: String,     // Preview image
    scale: {
      x: { type: Number, default: 1 },
      y: { type: Number, default: 1 },
      z: { type: Number, default: 1 }
    },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 }
    },
    rotation: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 }
    },
    animation: {
      type: String,
      enum: ['none', 'rotate', 'float', 'spin'],
      default: 'rotate'
    }
  },
  // AR Configuration
  arConfig: {
    markerType: {
      type: String,
      enum: ['image', 'location', 'surface'],
      default: 'surface'
    },
    markerImage: String,    // For image-based AR
    surfaceDetection: {
      type: Boolean,
      default: true
    },
    anchorToTable: {
      type: Boolean,
      default: true
    },
    allowScale: {
      type: Boolean,
      default: true
    },
    allowRotation: {
      type: Boolean,
      default: true
    }
  },
  // Nutritional info
  nutrition: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    allergens: [String],
    dietary: [String] // vegetarian, vegan, gluten-free, etc.
  },
  // Display settings
  isAvailable: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  arViews: {
    type: Number,
    default: 0
  },
  orders: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  nameAr: String,
  description: String,
  icon: String,
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  nameAr: String,
  description: String,
  descriptionAr: String,
  // Contact info
  address: String,
  phone: String,
  email: String,
  website: String,
  // Branding
  logo: String,
  coverImage: String,
  primaryColor: {
    type: String,
    default: '#1a1a2e'
  },
  secondaryColor: {
    type: String,
    default: '#16213e'
  },
  accentColor: {
    type: String,
    default: '#e94560'
  },
  // AR Settings
  arSettings: {
    defaultMarkerType: {
      type: String,
      enum: ['image', 'location', 'surface'],
      default: 'surface'
    },
    tableMarkerImage: String,
    qrCodeBaseUrl: String
  },
  // Social
  socialLinks: {
    instagram: String,
    facebook: String,
    twitter: String,
    tiktok: String
  },
  // Business hours
  openingHours: {
    monday: { open: String, close: String, closed: Boolean },
    tuesday: { open: String, close: String, closed: Boolean },
    wednesday: { open: String, close: String, closed: Boolean },
    thursday: { open: String, close: String, closed: Boolean },
    friday: { open: String, close: String, closed: Boolean },
    saturday: { open: String, close: String, closed: Boolean },
    sunday: { open: String, close: String, closed: Boolean }
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  slug: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

const menuSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  nameAr: String,
  description: String,
  descriptionAr: String,
  categories: [categorySchema],
  dishes: [dishSchema],
  // Menu settings
  settings: {
    language: {
      type: String,
      enum: ['en', 'ar', 'fr', 'es'],
      default: 'en'
    },
    rtl: {
      type: Boolean,
      default: false
    },
    showPrices: {
      type: Boolean,
      default: true
    },
    enableAR: {
      type: Boolean,
      default: true
    },
    arMode: {
      type: String,
      enum: ['marker', 'markerless', 'both'],
      default: 'markerless'
    }
  },
  // Analytics
  stats: {
    totalViews: { type: Number, default: 0 },
    totalARViews: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    popularDishes: [{
      dish: { type: mongoose.Schema.Types.ObjectId, ref: 'Dish' },
      views: Number,
      arViews: Number,
      orders: Number
    }]
  },
  version: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  publishedAt: Date
}, {
  timestamps: true
});

// Indexes
menuSchema.index({ restaurant: 1, isActive: 1 });
dishSchema.index({ category: 1, isAvailable: 1 });
restaurantSchema.index({ slug: 1 }, { unique: true, sparse: true });

// Virtual for full AR URL
menuSchema.virtual('arUrl').get(function() {
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  return `${baseUrl}/ar/${this._id}`;
});

menuSchema.virtual('menuUrl').get(function() {
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  return `${baseUrl}/menu/${this.restaurant}`;
});

const Restaurant = mongoose.model('Restaurant', restaurantSchema);
const Menu = mongoose.model('Menu', menuSchema);
const Category = mongoose.model('Category', categorySchema);
const Dish = mongoose.model('Dish', dishSchema);

module.exports = { Restaurant, Menu, Category, Dish };