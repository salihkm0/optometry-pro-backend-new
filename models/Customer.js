const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: [true, 'Shop reference is required'],
    index: true
  },
  customerId: {
    type: String,
    // unique: true,
    sparse: true
  },
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  dateOfBirth: {
    type: Date
  },
  age: {
    type: Number,
    min: [0, 'Age cannot be negative'],
    max: [150, 'Age seems unrealistic']
  },
  sex: {
    type: String,
    enum: ['Male', 'Female', 'Other', '']
  },
  phone: {
    type: String,
    trim: true,
    required: [true, 'Phone number is required']
    // Removed unique constraint - family members can share phone numbers
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true
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
  },
  medicalHistory: {
    diabetes: { type: Boolean, default: false },
    hypertension: { type: Boolean, default: false },
    glaucoma: { type: Boolean, default: false },
    cataract: { type: Boolean, default: false },
    allergies: [String],
    medications: [String],
    notes: String
  },
  insurance: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
    validUntil: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastVisit: {
    type: Date
  },
  totalVisits: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{
    type: String,
    enum: ['vip', 'frequent', 'new', 'referred', 'senior', 'child', 'contact_lens']
  }],
  notes: String
}, {
  timestamps: true
});

// Indexes
// Removed unique constraint from phone - now allows multiple customers with same phone
customerSchema.index({ shop: 1, phone: 1 }); // Regular index for performance only
customerSchema.index({ shop: 1, email: 1 }, { unique: true, sparse: true }); // Email remains unique
customerSchema.index({ shop: 1, name: 1 });
customerSchema.index({ shop: 1, isActive: 1 });
customerSchema.index({ shop: 1, lastVisit: -1 });
customerSchema.index({ shop: 1, tags: 1 });
customerSchema.index({ customerId: 1 }, { unique: true, sparse: true });

// Generate customer ID before saving
customerSchema.pre('save', async function(next) {
  if (!this.customerId) {
    const shop = await mongoose.model('Shop').findById(this.shop);
    const count = await mongoose.model('Customer').countDocuments({ shop: this.shop });
    this.customerId = `${shop.name.substring(0, 3).toUpperCase()}${(count + 1).toString().padStart(6, '0')}`;
  }
  
  if (this.dateOfBirth && !this.age) {
    const birthDate = new Date(this.dateOfBirth);
    const ageDiff = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiff);
    this.age = Math.abs(ageDate.getUTCFullYear() - 1970);
  }
  
  next();
});

// Update last visit and total visits when a record is created
customerSchema.statics.updateVisitStats = async function(customerId) {
  return this.findByIdAndUpdate(
    customerId,
    {
      $set: { lastVisit: new Date() },
      $inc: { totalVisits: 1 }
    },
    { new: true }
  );
};

// Static method for customer search
customerSchema.statics.searchCustomers = async function(shopId, searchTerm) {
  return this.find({
    shop: shopId,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { phone: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { customerId: { $regex: searchTerm, $options: 'i' } }
    ]
  }).limit(20);
};

// Optional: Method to find family members sharing same phone
customerSchema.statics.findFamilyMembers = async function(shopId, phone) {
  return this.find({
    shop: shopId,
    phone: phone,
    isActive: true
  }).select('name customerId phone dateOfBirth sex relationship');
};

module.exports = mongoose.model('Customer', customerSchema);