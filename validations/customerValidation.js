// validations/customerValidation.js
const Joi = require('joi');

const createCustomerValidation = Joi.object({
  name: Joi.string()
    .max(100)
    .trim()
    .required()
    .messages({
      'string.empty': 'Customer name is required',
      'any.required': 'Customer name is required'
    }),
  
  phone: Joi.string()
    .pattern(/^[\+]?[1-9][\d]{0,15}$/)
    .trim()
    .required()
    .messages({
      'string.empty': 'Phone number is required',
      'any.required': 'Phone number is required',
      'string.pattern.base': 'Please enter a valid phone number'
    }),
  
  email: Joi.string()
    .email()
    .trim()
    .lowercase()
    .optional()
    .allow(''),
  
  age: Joi.number()
    .integer()
    .min(0)
    .max(150)
    .optional(),
  
  sex: Joi.string()
    .valid('Male', 'Female', 'Other', '')
    .optional()
    .allow(''),
  
  dateOfBirth: Joi.date()
    .optional()
    .allow(null),
  
  address: Joi.object({
    street: Joi.string().optional().allow(''),
    city: Joi.string().optional().allow(''),
    state: Joi.string().optional().allow(''),
    zipCode: Joi.string().optional().allow(''),
    country: Joi.string().default('USA')
  }).optional(),
  
  medicalHistory: Joi.object({
    diabetes: Joi.boolean().default(false),
    hypertension: Joi.boolean().default(false),
    glaucoma: Joi.boolean().default(false),
    cataract: Joi.boolean().default(false),
    allergies: Joi.array().items(Joi.string()),
    medications: Joi.array().items(Joi.string()),
    notes: Joi.string().optional().allow('')
  }).optional(),
  
  insurance: Joi.object({
    provider: Joi.string().optional().allow(''),
    policyNumber: Joi.string().optional().allow(''),
    groupNumber: Joi.string().optional().allow(''),
    validUntil: Joi.date().optional().allow(null)
  }).optional(),
  
  tags: Joi.array()
    .items(Joi.string().valid('vip', 'frequent', 'new', 'referred', 'senior', 'child', 'contact_lens'))
    .optional(),
  
  notes: Joi.string().optional().allow('')
});

const updateCustomerValidation = Joi.object({
  name: Joi.string()
    .max(100)
    .trim()
    .optional()
    .allow(''),
  
  phone: Joi.string()
    .pattern(/^[\+]?[1-9][\d]{0,15}$/)
    .trim()
    .optional()
    .allow('')
    .messages({
      'string.pattern.base': 'Please enter a valid phone number'
    }),
  
  email: Joi.string()
    .email()
    .trim()
    .lowercase()
    .optional()
    .allow(''),
  
  isActive: Joi.boolean()
    .optional(),
  
  age: Joi.number()
    .integer()
    .min(0)
    .max(150)
    .optional()
    .allow(null),
  
  sex: Joi.string()
    .valid('Male', 'Female', 'Other', '')
    .optional()
    .allow(''),
  
  dateOfBirth: Joi.date()
    .optional()
    .allow(null),
  
  address: Joi.object({
    street: Joi.string().optional().allow(''),
    city: Joi.string().optional().allow(''),
    state: Joi.string().optional().allow(''),
    zipCode: Joi.string().optional().allow(''),
    country: Joi.string().default('USA')
  }).optional(),
  
  medicalHistory: Joi.object({
    diabetes: Joi.boolean().default(false),
    hypertension: Joi.boolean().default(false),
    glaucoma: Joi.boolean().default(false),
    cataract: Joi.boolean().default(false),
    allergies: Joi.array().items(Joi.string()),
    medications: Joi.array().items(Joi.string()),
    notes: Joi.string().optional().allow('')
  }).optional(),
  
  insurance: Joi.object({
    provider: Joi.string().optional().allow(''),
    policyNumber: Joi.string().optional().allow(''),
    groupNumber: Joi.string().optional().allow(''),
    validUntil: Joi.date().optional().allow(null)
  }).optional(),
  
  tags: Joi.array()
    .items(Joi.string().valid('vip', 'frequent', 'new', 'referred', 'senior', 'child', 'contact_lens'))
    .optional(),
  
  notes: Joi.string().optional().allow('')
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

module.exports = {
  createCustomerValidation,
  updateCustomerValidation
};