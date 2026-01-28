const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
    index: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Billing',
    index: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  method: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'insurance', 'cheque', 'credit', 'other'],
    required: true
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  referenceNumber: String,
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'completed'
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ shop: 1, date: -1 });
paymentSchema.index({ shop: 1, customer: 1, date: -1 });
paymentSchema.index({ shop: 1, method: 1 });

module.exports = mongoose.model('Payment', paymentSchema);