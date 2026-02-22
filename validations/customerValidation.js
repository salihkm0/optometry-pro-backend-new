const { body } = require('express-validator');
const Joi = require('joi');

const createCustomerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Customer name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please enter a valid phone number'),
  
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  
  body('age')
    .optional()
    .isInt({ min: 0, max: 150 })
    .withMessage('Age must be between 0 and 150'),
  
  body('sex')
    .optional()
    .isIn(['Male', 'Female', 'Other', ''])
    .withMessage('Invalid gender value'),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please enter a valid date of birth'),
  
  body('address.street')
    .optional()
    .trim(),
  
  body('address.city')
    .optional()
    .trim(),
  
  body('address.state')
    .optional()
    .trim(),
  
  body('address.zipCode')
    .optional()
    .trim(),
  
  body('medicalHistory.diabetes')
    .optional()
    .isBoolean()
    .withMessage('Diabetes must be a boolean'),
  
  body('medicalHistory.hypertension')
    .optional()
    .isBoolean()
    .withMessage('Hypertension must be a boolean'),
  
  body('medicalHistory.glaucoma')
    .optional()
    .isBoolean()
    .withMessage('Glaucoma must be a boolean'),
  
  body('medicalHistory.cataract')
    .optional()
    .isBoolean()
    .withMessage('Cataract must be a boolean'),
  
  body('insurance.provider')
    .optional()
    .trim(),
  
  body('insurance.policyNumber')
    .optional()
    .trim(),
  
  body('insurance.validUntil')
    .optional()
    .isISO8601()
    .withMessage('Please enter a valid date'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .isIn(['vip', 'frequent', 'new', 'referred', 'senior', 'child', 'contact_lens'])
    .withMessage('Invalid tag value')
];

const updateCustomerValidation = Joi.object({
  name: Joi.string()
    .max(100)
    .trim()
    .optional(),
  
  phone: Joi.string()
    .pattern(/^[\+]?[1-9][\d]{0,15}$/)
    .trim()
    .optional()
    .messages({
      'string.pattern.base': 'Please enter a valid phone number'
    }),
  
  email: Joi.string()
    .email()
    .trim()
    .lowercase()
    .optional(),
  
  isActive: Joi.boolean()
    .optional(),
  
  age: Joi.number()
    .integer()
    .min(0)
    .max(150)
    .optional(),
  
  sex: Joi.string()
    .valid('Male', 'Female', 'Other', '')
    .optional(),
  
  dateOfBirth: Joi.date()
    .optional(),
  
  address: Joi.object({
    street: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    zipCode: Joi.string().optional(),
    country: Joi.string().default('USA')
  }).optional(),
  
  medicalHistory: Joi.object({
    diabetes: Joi.boolean().default(false),
    hypertension: Joi.boolean().default(false),
    glaucoma: Joi.boolean().default(false),
    cataract: Joi.boolean().default(false),
    allergies: Joi.array().items(Joi.string()),
    medications: Joi.array().items(Joi.string()),
    notes: Joi.string()
  }).optional(),
  
  insurance: Joi.object({
    provider: Joi.string().optional(),
    policyNumber: Joi.string().optional(),
    groupNumber: Joi.string().optional(),
    validUntil: Joi.date().optional()
  }).optional(),
  
  tags: Joi.array()
    .items(Joi.string().valid('vip', 'frequent', 'new', 'referred', 'senior', 'child', 'contact_lens'))
    .optional(),
  
  notes: Joi.string().optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});
module.exports = {
  createCustomerValidation,
  updateCustomerValidation
};