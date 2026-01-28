const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  appointmentId: {
    type: String,
    unique: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    default: 30
  },
  type: {
    type: String,
    enum: ['checkup', 'follow_up', 'contact_lens_fitting', 'emergency', 'other'],
    default: 'checkup'
  },
  optometrist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'scheduled'
  },
  notes: String,
  reminderSent: {
    sms: { type: Boolean, default: false },
    email: { type: Boolean, default: false }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
appointmentSchema.index({ shop: 1, date: 1 });
appointmentSchema.index({ shop: 1, customer: 1 });
appointmentSchema.index({ shop: 1, optometrist: 1, date: 1 });
appointmentSchema.index({ shop: 1, status: 1, date: 1 });
appointmentSchema.index({ appointmentId: 1 }, { unique: true });

// Generate appointment ID
appointmentSchema.pre('save', async function(next) {
  if (!this.appointmentId) {
    const count = await mongoose.model('Appointment').countDocuments({ shop: this.shop });
    this.appointmentId = `APT${this.shop.toString().substr(-4)}${(count + 1).toString().padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);