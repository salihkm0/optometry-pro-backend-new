const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Shop name is required'],
    trim: true,
    maxlength: [200, 'Shop name cannot exceed 200 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !this.isNew;
    }
  },
  contact: {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      trim: true,
      required: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'USA'
      }
    }
  },
  logo: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    appointmentDuration: {
      type: Number,
      default: 30,
      min: 15,
      max: 120
    },
    workingHours: {
      monday: { start: String, end: String, closed: Boolean },
      tuesday: { start: String, end: String, closed: Boolean },
      wednesday: { start: String, end: String, closed: Boolean },
      thursday: { start: String, end: String, closed: Boolean },
      friday: { start: String, end: String, closed: Boolean },
      saturday: { start: String, end: String, closed: Boolean },
      sunday: { start: String, end: String, closed: Boolean }
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    currency: {
      type: String,
      default: 'USD'
    },
    timezone: {
      type: String,
      default: 'America/New_York'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    startDate: Date,
    endDate: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes
shopSchema.index({ owner: 1 });
shopSchema.index({ isActive: 1 });
shopSchema.index({ 'contact.email': 1 });
shopSchema.index({ 'contact.phone': 1 });
shopSchema.index({ 'subscription.isActive': 1, 'subscription.endDate': 1 });

// Virtual for total customers
shopSchema.virtual('customerCount', {
  ref: 'Customer',
  localField: '_id',
  foreignField: 'shop',
  count: true
});

// Virtual for total users
shopSchema.virtual('userCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'shop',
  count: true
});

// Static method to get shops with statistics
shopSchema.statics.getShopsWithStats = async function(ownerId = null) {
  const matchStage = ownerId ? { owner: ownerId } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'customers',
        localField: '_id',
        foreignField: 'shop',
        as: 'customers'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: 'shop',
        as: 'users'
      }
    },
    {
      $project: {
        name: 1,
        'contact.email': 1,
        'contact.phone': 1,
        'contact.address': 1,
        isActive: 1,
        settings: 1,
        customerCount: { $size: '$customers' },
        userCount: { $size: '$users' },
        createdAt: 1
      }
    }
  ]);
};

module.exports = mongoose.model('Shop', shopSchema);