const Joi = require('joi');

const productSchema = Joi.object({
  name: Joi.string().required().trim().max(200),
  description: Joi.string().trim().allow(''),
  code: Joi.string().trim().allow(''),
  mrp: Joi.number().required().min(0),
  quantity: Joi.number().required().min(1),
  discount: Joi.number().min(0),
  taxRate: Joi.number().min(0).max(100),
  taxAmount: Joi.number().min(0)
});

const createBillingValidation = Joi.object({
  customer: Joi.string().required(),
  invoiceDate: Joi.date().default(Date.now),
  dueDate: Joi.date().greater(Joi.ref('invoiceDate')),
  
  products: Joi.array().items(productSchema).min(1).required(),
  
  additionalDiscount: Joi.number().min(0),
  discountType: Joi.string().valid('fixed', 'percentage'),
  discountPercentage: Joi.when('discountType', {
    is: 'percentage',
    then: Joi.number().min(0).max(100).required(),
    otherwise: Joi.number().min(0).max(100)
  }),
  
  payment: Joi.object({
    method: Joi.string().valid('cash', 'card', 'upi', 'bank_transfer', 'insurance', 'cheque', 'credit', 'other').default('cash'),
    amount: Joi.number().min(0),
    transactionId: Joi.string().allow(''),
    paymentDate: Joi.date(),
    notes: Joi.string().allow(''),
    referenceNumber: Joi.string().allow('')
  }),
  
  billingType: Joi.string().valid('sale', 'service', 'prescription', 'other').default('sale'),
  optometrist: Joi.string().allow(''),
  prescription: Joi.string().allow(''),
  
  notes: Joi.string().allow(''),
  terms: Joi.string().allow(''),
  
  delivery: Joi.object({
    required: Joi.boolean().default(false),
    address: Joi.string().allow(''),
    expectedDate: Joi.date(),
    shippingCost: Joi.number().min(0).default(0)
  }).optional(),
  
  status: Joi.string().valid('draft', 'generated').default('draft')
});

const updateBillingValidation = Joi.object({
  customer: Joi.string(),
  invoiceDate: Joi.date(),
  dueDate: Joi.date(),
  
  products: Joi.array().items(productSchema).min(1),
  
  additionalDiscount: Joi.number().min(0),
  discountType: Joi.string().valid('fixed', 'percentage'),
  discountPercentage: Joi.when('discountType', {
    is: 'percentage',
    then: Joi.number().min(0).max(100).required(),
    otherwise: Joi.number().min(0).max(100)
  }),
  
  payment: Joi.object({
    method: Joi.string().valid('cash', 'card', 'upi', 'bank_transfer', 'insurance', 'cheque', 'credit', 'other'),
    amount: Joi.number().min(0),
    status: Joi.string().valid('pending', 'partial', 'paid', 'cancelled', 'refunded'),
    transactionId: Joi.string().allow(''),
    paymentDate: Joi.date(),
    notes: Joi.string().allow(''),
    referenceNumber: Joi.string().allow('')
  }),
  
  billingType: Joi.string().valid('sale', 'service', 'prescription', 'other'),
  optometrist: Joi.string().allow(''),
  prescription: Joi.string().allow(''),
  
  notes: Joi.string().allow(''),
  terms: Joi.string().allow(''),
  
  delivery: Joi.object({
    required: Joi.boolean(),
    address: Joi.string().allow(''),
    expectedDate: Joi.date(),
    deliveredDate: Joi.date(),
    status: Joi.string().valid('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
    trackingNumber: Joi.string().allow(''),
    shippingCost: Joi.number().min(0)
  }),
  
  status: Joi.string().valid('draft', 'generated', 'cancelled', 'void', 'archived')
});

const updatePaymentValidation = Joi.object({
  amount: Joi.number().required().min(0),
  method: Joi.string().valid('cash', 'card', 'upi', 'bank_transfer', 'insurance', 'cheque', 'credit', 'other').required(),
  transactionId: Joi.string().allow(''),
  paymentDate: Joi.date().default(Date.now),
  notes: Joi.string().allow(''),
  referenceNumber: Joi.string().allow('')
});

const cancelBillingValidation = Joi.object({
  reason: Joi.string().required().min(5).max(500)
});

const searchBillingValidation = Joi.object({
  search: Joi.string().allow(''),
  customer: Joi.string().allow(''),
  startDate: Joi.date(),
  endDate: Joi.date(),
  status: Joi.string().valid('draft', 'generated', 'cancelled', 'void', 'archived'),
  paymentStatus: Joi.string().valid('pending', 'partial', 'paid', 'cancelled', 'refunded'),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20)
});

module.exports = {
  createBillingValidation,
  updateBillingValidation,
  updatePaymentValidation,
  cancelBillingValidation,
  searchBillingValidation
};