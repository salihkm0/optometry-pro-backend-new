const { body } = require('express-validator');

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

const updateCustomerValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please enter a valid phone number'),
  
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  body('age')
    .optional()
    .isInt({ min: 0, max: 150 })
    .withMessage('Age must be between 0 and 150')
];

module.exports = {
  createCustomerValidation,
  updateCustomerValidation
};