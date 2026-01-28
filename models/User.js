const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const validPermissions = [
  'manage_users',
  'manage_customers',
  'manage_records',
  'view_reports',
  'manage_inventory',
  'manage_appointments',
  'billing',
  'settings'
];

const validRoles = [
  'super_admin',
  'admin', 
  'shop_owner',
  'optometrist',
  'assistant',
  'receptionist'
];

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: validRoles,
    default: 'optometrist'
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: function() {
      return this.role !== 'super_admin' && this.role !== 'admin';
    }
  },
  refreshToken: {
    type: String,
    default: null,
    select: false
  },
  lastLogin: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  department: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  permissions: {
    type: [{
      type: String,
      enum: validPermissions
    }],
    default: [],
    validate: {
      validator: function(v) {
        // Ensure all permissions are valid strings
        return Array.isArray(v) && v.every(p => 
          typeof p === 'string' && validPermissions.includes(p)
        );
      },
      message: props => `Invalid permissions: ${props.value}. Must be one of: ${validPermissions.join(', ')}`
    }
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ shop: 1, role: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ 'permissions': 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Clean and validate permissions before save
userSchema.pre('save', function(next) {
  // Ensure permissions is always an array
  if (!Array.isArray(this.permissions)) {
    this.permissions = [];
  }
  
  // Remove any null, undefined, or empty values
  this.permissions = this.permissions.filter(p => 
    p !== null && p !== undefined && p !== ''
  );
  
  // Convert to strings and trim
  this.permissions = this.permissions.map(p => {
    if (typeof p === 'string') {
      return p.trim();
    }
    // If it's an object, try to convert to string
    if (typeof p === 'object') {
      try {
        return JSON.stringify(p).trim();
      } catch {
        return '';
      }
    }
    // For other types, convert to string
    return String(p).trim();
  });
  
  // Remove empty strings after conversion
  this.permissions = this.permissions.filter(p => p.length > 0);
  
  // Filter only valid permissions
  this.permissions = this.permissions.filter(p => 
    validPermissions.includes(p)
  );
  
  // Remove duplicates
  this.permissions = [...new Set(this.permissions)];
  
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user has permission
userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'super_admin') return true;
  if (this.role === 'admin') return true;
  return this.permissions && this.permissions.includes(permission);
};

// Get all permissions for the user's role
userSchema.methods.getAllPermissions = function() {
  if (this.role === 'super_admin' || this.role === 'admin') {
    return [...validPermissions];
  }
  return this.permissions || [];
};

// Get user's accessible shops (for admin users)
userSchema.methods.getAccessibleShops = async function() {
  if (this.role === 'super_admin' || this.role === 'admin') {
    return await mongoose.model('Shop').find({ isActive: true });
  }
  return await mongoose.model('Shop').find({ _id: this.shop, isActive: true });
};

// Get user's public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    shop: this.shop,
    department: this.department,
    profileImage: this.profileImage,
    permissions: this.permissions,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt
  };
};

// Static method to find by email or phone
userSchema.statics.findByEmailOrPhone = function(email, phone) {
  const conditions = [];
  
  if (email) {
    conditions.push({ email: email.toLowerCase().trim() });
  }
  
  if (phone) {
    conditions.push({ phone: phone.trim() });
  }
  
  if (conditions.length === 0) {
    return null;
  }
  
  return this.findOne({
    $or: conditions
  });
};

// Static method to validate permissions array
userSchema.statics.validatePermissions = function(permissions) {
  if (!Array.isArray(permissions)) {
    return [];
  }
  
  return permissions
    .filter(p => p && typeof p === 'string')
    .map(p => p.trim())
    .filter(p => p.length > 0 && validPermissions.includes(p));
};

module.exports = mongoose.model('User', userSchema);