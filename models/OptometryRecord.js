const mongoose = require('mongoose');

const eyeMeasurementSchema = new mongoose.Schema({
  sph: { type: String, default: '' },
  cyl: { type: String, default: '' },
  axis: { type: String, default: '' },
  va: { type: String, default: '' }
});

const eyeSchema = new mongoose.Schema({
  dv: { type: eyeMeasurementSchema, default: () => ({}) },
  nv: { type: eyeMeasurementSchema, default: () => ({}) },
  add: { type: eyeMeasurementSchema, default: () => ({}) },
  ph: { type: String, default: '' },
  prism: { type: String, default: '' },
  base: { type: String, default: '' },
  pd: { type: String, default: '' },
  notes: { type: String, default: '' }
});

const optometryRecordSchema = new mongoose.Schema({
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
  recordId: {
    type: String,
    // unique: true
  },
  date: {
    type: Date,
    required: [true, 'Examination date is required'],
    default: Date.now
  },
  
  // Eye Measurements
  right_eye: { type: eyeSchema, default: () => ({}) },
  left_eye: { type: eyeSchema, default: () => ({}) },
  
  // Professional Information
  optometrist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assistant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Examination Details
  examinationType: {
    type: String,
    enum: ['routine', 'comprehensive', 'contact_lens', 'follow_up', 'emergency', 'other'],
    default: 'routine'
  },
  
  // Subjective Findings
  chiefComplaint: String,
  history: String,
  diagnosis: String,
  recommendations: String,
  notes: String,
  
  // Objective Findings
  slitLampFindings: String,
  retinaFindings: String,
  iop: {
    right: String,
    left: String,
    method: String,
    time: String
  },
  
  // Prescription Details
  prescriptionType: {
    type: String,
    enum: ['distance', 'reading', 'bifocal', 'progressive', 'computer', 'sunglasses', 'contact_lens', 'other']
  },
  lensType: String,
  frame: String,
  tint: String,
  coating: [String],
  
  // Follow-up Information
  nextAppointment: Date,
  followUpNotes: String,
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'completed', 'cancelled', 'archived'],
    default: 'completed'
  },
  
  // Billing Information
  billing: {
    amount: Number,
    paid: Number,
    discount: Number,
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'insurance', 'online', 'other']
    },
    insuranceClaimed: Boolean,
    invoiceId: String
  },
  
  // Digital Signature
  signedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  signatureDate: Date,
  
  // Attachments
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
optometryRecordSchema.index({ shop: 1, customer: 1 });
optometryRecordSchema.index({ shop: 1, date: -1 });
optometryRecordSchema.index({ customer: 1, date: -1 });
optometryRecordSchema.index({ shop: 1, optometrist: 1 });
optometryRecordSchema.index({ shop: 1, status: 1 });
optometryRecordSchema.index({ recordId: 1 }, { unique: true });
optometryRecordSchema.index({ shop: 1, 'billing.invoiceId': 1 }, { sparse: true });

// Generate record ID before saving
optometryRecordSchema.pre('save', async function(next) {
  if (!this.recordId) {
    const shop = await mongoose.model('Shop').findById(this.shop);
    const count = await mongoose.model('OptometryRecord').countDocuments({ shop: this.shop });
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    this.recordId = `OPT${shop.name.substring(0, 3).toUpperCase()}${year}${month}${(count + 1).toString().padStart(4, '0')}`;
  }
  
  if (this.isNew && this.status === 'completed') {
    // Update customer's last visit
    await mongoose.model('Customer').updateVisitStats(this.customer);
  }
  
  next();
});

// Static method to get records by date range
optometryRecordSchema.statics.findByDateRange = async function(shopId, startDate, endDate, filters = {}) {
  const query = {
    shop: shopId,
    date: {
      $gte: startDate,
      $lte: endDate
    },
    ...filters
  };
  
  return this.find(query)
    .populate('customer', 'name age sex phone customerId')
    .populate('optometrist', 'name role')
    .populate('assistant', 'name role')
    .sort({ date: -1 });
};

// Static method to get statistics
optometryRecordSchema.statics.getStats = async function(shopId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        shop: mongoose.Types.ObjectId(shopId),
        date: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalRecords: { $sum: 1 },
        totalRevenue: { $sum: '$billing.amount' },
        averageAmount: { $avg: '$billing.amount' },
        byExaminationType: {
          $push: {
            type: '$examinationType',
            amount: '$billing.amount'
          }
        }
      }
    },
    {
      $project: {
        totalRecords: 1,
        totalRevenue: 1,
        averageAmount: 1,
        examinationStats: {
          $arrayToObject: {
            $map: {
              input: '$byExaminationType',
              as: 'item',
              in: {
                k: '$$item.type',
                v: { $sum: ['$$item.amount'] }
              }
            }
          }
        }
      }
    }
  ]);
};

// Virtual for patient age at examination
optometryRecordSchema.virtual('patientAgeAtExam').get(function() {
  // This would need customer data populated
  return null;
});

// Method to calculate prescription summary
optometryRecordSchema.methods.getPrescriptionSummary = function() {
  const summary = {
    hasPrescription: false,
    types: [],
    details: {}
  };
  
  if (this.right_eye.dv.sph || this.left_eye.dv.sph) {
    summary.hasPrescription = true;
    summary.types.push('distance');
  }
  
  if (this.right_eye.nv.sph || this.left_eye.nv.sph) {
    summary.hasPrescription = true;
    summary.types.push('near');
  }
  
  if (this.right_eye.add.sph || this.left_eye.add.sph) {
    summary.types.push('add');
  }
  
  return summary;
};

module.exports = mongoose.model('OptometryRecord', optometryRecordSchema);