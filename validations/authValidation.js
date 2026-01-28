const { body } = require('express-validator');

const validRoles = ['super_admin', 'admin', 'shop_owner', 'optometrist', 'assistant', 'receptionist'];
const validPermissions = [
  'manage_users',
  'manage_customers',
  'manage_records',
  'view_reports',
  'manage_inventory',
  'manage_appointments',
  'billing',
  'settings'
];

const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please enter a valid phone number'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  
  body('role')
    .optional()
    .isIn(validRoles)
    .withMessage('Invalid role'),
  
  body('shop')
    .optional()
    .isMongoId()
    .withMessage('Invalid shop ID'),
  
  body('permissions')
    .optional()
    .custom((value) => {
      // If permissions is provided, it must be an array
      if (value && !Array.isArray(value)) {
        throw new Error('Permissions must be an array');
      }
      return true;
    })
    .customSanitizer((value) => {
      // Clean permissions: ensure all are strings and valid
      if (Array.isArray(value)) {
        return value
          .filter(p => p !== null && p !== undefined && p !== '')
          .map(p => typeof p === 'string' ? p.trim() : String(p).trim())
          .filter(p => validPermissions.includes(p));
      }
      return value;
    }),
  
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department cannot exceed 100 characters')
];

const loginValidation = [
  body('email')
    .if(body('phone').isEmpty())
    .trim()
    .notEmpty()
    .withMessage('Email or phone is required')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  
  body('phone')
    .if(body('email').isEmpty())
    .trim()
    .notEmpty()
    .withMessage('Email or phone is required')
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please enter a valid phone number'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const updateProfileValidation = [
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
  
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department cannot exceed 100 characters'),
  
  body('permissions')
    .optional()
    .custom((value) => {
      if (value && !Array.isArray(value)) {
        throw new Error('Permissions must be an array');
      }
      return true;
    })
    .customSanitizer((value) => {
      if (Array.isArray(value)) {
        return value
          .filter(p => p !== null && p !== undefined && p !== '')
          .map(p => typeof p === 'string' ? p.trim() : String(p).trim())
          .filter(p => validPermissions.includes(p));
      }
      return value;
    })
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
  
  body('confirmPassword')
    .notEmpty()
    .withMessage('Confirm password is required')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match')
];

const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail()
];

const resetPasswordValidation = [
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  
  body('confirmPassword')
    .notEmpty()
    .withMessage('Confirm password is required')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match')
];

module.exports = {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  validPermissions,
  validRoles
};