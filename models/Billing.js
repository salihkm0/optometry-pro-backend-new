const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  code: {
    type: String,
    trim: true
  },
  mrp: {
    type: Number,
    required: [true, 'MRP is required'],
    min: [0, 'MRP cannot be negative']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  taxRate: {
    type: Number,
    default: 0,
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%']
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: [0, 'Tax amount cannot be negative']
  },
  total: {
    type: Number,
    required: true,
    min: [0, 'Total cannot be negative']
  }
}, {
  _id: true
});

const billingSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: [true, 'Shop reference is required'],
    index: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer reference is required'],
    index: true
  },
  // ADD THIS FIELD
  optometrist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  products: [productSchema],
  
  // Totals
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  totalDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  additionalDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Additional discount cannot be negative']
  },
  discountType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed'
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100%']
  },
  totalTax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  finalAmount: {
    type: Number,
    required: true,
    min: [0, 'Final amount cannot be negative']
  },
  
  // Payment Information
  payment: {
    method: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank_transfer', 'insurance', 'cheque', 'credit', 'other'],
      default: 'cash'
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Payment amount cannot be negative']
    },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'cancelled', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    paymentDate: Date,
    notes: String,
    referenceNumber: String
  },
  
  // Billing Details
  billingType: {
    type: String,
    enum: ['sale', 'service', 'prescription', 'other'],
    default: 'sale'
  },
  
  // ADD prescription field if needed
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    default: null
  },
  
  // Additional Information
  notes: {
    type: String,
    trim: true
  },
  terms: {
    type: String,
    trim: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'generated', 'cancelled', 'void', 'archived'],
    default: 'draft'
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
billingSchema.index({ shop: 1, invoiceNumber: 1 });
billingSchema.index({ shop: 1, customer: 1, invoiceDate: -1 });
billingSchema.index({ shop: 1, invoiceDate: -1 });
billingSchema.index({ shop: 1, 'payment.status': 1 });
billingSchema.index({ shop: 1, status: 1 });
billingSchema.index({ shop: 1, 'payment.method': 1 });
// ADD index for optometrist
billingSchema.index({ shop: 1, optometrist: 1 });

// Pre-save middleware to generate invoice number and calculate totals
billingSchema.pre('save', async function(next) {
  try {
    // Generate invoice number if not provided
    if (!this.invoiceNumber) {
      const shop = await mongoose.model('Shop').findById(this.shop);
      const count = await mongoose.model('Billing').countDocuments({
        shop: this.shop,
        invoiceDate: {
          $gte: new Date(new Date().getFullYear(), 0, 1),
          $lt: new Date(new Date().getFullYear() + 1, 0, 1)
        }
      });
      const year = new Date().getFullYear().toString().substr(-2);
      this.invoiceNumber = `INV-${shop?.name?.substring(0, 3).toUpperCase() || 'SHP'}${year}${(count + 1).toString().padStart(5, '0')}`;
    }
    
    // Calculate due date if not provided (default: 30 days from invoice date)
    if (!this.dueDate) {
      this.dueDate = new Date(this.invoiceDate);
      this.dueDate.setDate(this.dueDate.getDate() + 30);
    }
    
    // Calculate product totals if not already calculated
    if (this.products && this.products.length > 0) {
      this.products.forEach(product => {
        const productTotal = product.mrp * product.quantity;
        const productDiscount = product.discount || 0;
        const productNet = productTotal - productDiscount;
        
        // Calculate tax if not provided
        if (!product.taxAmount && product.taxRate > 0) {
          product.taxAmount = (productNet * product.taxRate) / 100;
        }
        
        product.total = productNet + (product.taxAmount || 0);
      });
      
      // Calculate totals if not provided
      if (!this.subtotal) {
        this.subtotal = this.products.reduce((sum, product) => sum + (product.mrp * product.quantity), 0);
      }
      
      if (!this.totalDiscount) {
        const productDiscount = this.products.reduce((sum, product) => sum + (product.discount || 0), 0);
        this.totalDiscount = productDiscount + (this.additionalDiscount || 0);
      }
      
      if (!this.totalTax) {
        this.totalTax = this.products.reduce((sum, product) => sum + (product.taxAmount || 0), 0);
      }
      
      if (!this.finalAmount) {
        this.finalAmount = this.subtotal - this.totalDiscount + this.totalTax;
      }
    }
    
    // Set payment amount to final amount if not specified
    if (!this.payment || !this.payment.amount || this.payment.amount === 0) {
      if (!this.payment) this.payment = {};
      this.payment.amount = this.finalAmount || 0;
    }
    
    // Update payment status based on amount
    if (this.payment) {
      if (this.payment.amount >= this.finalAmount) {
        this.payment.status = 'paid';
      } else if (this.payment.amount > 0 && this.payment.amount < this.finalAmount) {
        this.payment.status = 'partial';
      } else {
        this.payment.status = 'pending';
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Billing', billingSchema);