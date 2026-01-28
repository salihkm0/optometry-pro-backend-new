const { body } = require('express-validator');

const createShopValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Shop name is required')
    .isLength({ max: 200 })
    .withMessage('Shop name cannot exceed 200 characters'),
  
  body('contact.email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  
  body('contact.phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please enter a valid phone number'),
  
  body('contact.address.street')
    .optional()
    .trim(),
  
  body('contact.address.city')
    .optional()
    .trim(),
  
  body('contact.address.state')
    .optional()
    .trim(),
  
  body('contact.address.zipCode')
    .optional()
    .trim()
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Please enter a valid zip code'),
  
  body('owner.name')
    .trim()
    .notEmpty()
    .withMessage('Owner name is required'),
  
  body('owner.email')
    .trim()
    .notEmpty()
    .withMessage('Owner email is required')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  
  body('owner.phone')
    .trim()
    .notEmpty()
    .withMessage('Owner phone is required')
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please enter a valid phone number'),
  
  body('owner.password')
    .notEmpty()
    .withMessage('Owner password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  
  body('settings.appointmentDuration')
    .optional()
    .isInt({ min: 15, max: 120 })
    .withMessage('Appointment duration must be between 15 and 120 minutes'),
  
  body('settings.taxRate')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Tax rate must be between 0 and 100'),
  
  body('subscription.plan')
    .optional()
    .isIn(['free', 'basic', 'premium', 'enterprise'])
    .withMessage('Invalid subscription plan')
];

const updateShopValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Shop name cannot exceed 200 characters'),
  
  body('contact.email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  
  body('contact.phone')
    .optional()
    .trim()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please enter a valid phone number'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

module.exports = {
  createShopValidation,
  updateShopValidation
};