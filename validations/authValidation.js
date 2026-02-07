const Joi = require('joi');

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

// Common validation patterns
const phonePattern = /^[\+]?[1-9][\d\s\-\(\)\.]{7,15}$/;
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const registerValidation = Joi.object({
  name: Joi.string()
    .required()
    .max(100)
    .messages({
      'string.empty': 'Name is required',
      'string.max': 'Name cannot exceed 100 characters'
    }),
  
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email'
    }),
  
  phone: Joi.string()
    .pattern(phonePattern)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'Please enter a valid phone number'
    }),
  
  password: Joi.string()
    .required()
    .min(6)
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 6 characters'
    }),
  
  role: Joi.string()
    .valid(...validRoles)
    .default('optometrist')
    .optional(),
  
  shop: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid shop ID'
    }),
  
  permissions: Joi.array()
    .items(Joi.string().valid(...validPermissions))
    .optional(),
  
  department: Joi.string()
    .max(100)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Department cannot exceed 100 characters'
    })
});

// Fix: Create a simple login validation without complex when() conditions
const loginValidation = Joi.object({
  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Please enter a valid email'
    }),
  
  phone: Joi.string()
    .pattern(phonePattern)
    .optional()
    .messages({
      'string.pattern.base': 'Please enter a valid phone number'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required'
    })
})
.custom((value, helpers) => {
  // Custom validation to check if at least email or phone is provided
  const { email, phone } = value;
  
  if (!email && !phone) {
    return helpers.error('any.required');
  }
  
  return value;
})
.messages({
  'any.required': 'Email or phone is required'
});

const updateProfileValidation = Joi.object({
  name: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Name cannot exceed 100 characters'
    }),
  
  phone: Joi.string()
    .pattern(phonePattern)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'Please enter a valid phone number'
    }),
  
  department: Joi.string()
    .max(100)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Department cannot exceed 100 characters'
    }),
  
  profileImage: Joi.string()
    .uri()
    .allow('', null)
    .optional()
    .messages({
      'string.uri': 'Profile image must be a valid URL'
    }),
  
  permissions: Joi.array()
    .items(Joi.string().valid(...validPermissions))
    .optional()
});

const changePasswordValidation = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'string.empty': 'Current password is required'
    }),
  
  newPassword: Joi.string()
    .required()
    .min(6)
    .messages({
      'string.empty': 'New password is required',
      'string.min': 'New password must be at least 6 characters'
    }),
  
  confirmPassword: Joi.string()
    .required()
    .valid(Joi.ref('newPassword'))
    .messages({
      'string.empty': 'Confirm password is required',
      'any.only': 'Passwords do not match'
    })
});

const forgotPasswordValidation = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email'
    })
});

const resetPasswordValidation = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'string.empty': 'Reset token is required'
    }),
  
  password: Joi.string()
    .required()
    .min(6)
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 6 characters'
    }),
  
  confirmPassword: Joi.string()
    .required()
    .valid(Joi.ref('password'))
    .messages({
      'string.empty': 'Confirm password is required',
      'any.only': 'Passwords do not match'
    })
});

const createUserValidation = Joi.object({
  name: Joi.string()
    .required()
    .max(100)
    .messages({
      'string.empty': 'Name is required',
      'string.max': 'Name cannot exceed 100 characters'
    }),
  
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email'
    }),
  
  phone: Joi.string()
    .pattern(phonePattern)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'Please enter a valid phone number'
    }),
  
  password: Joi.string()
    .optional()
    .min(6)
    .messages({
      'string.min': 'Password must be at least 6 characters'
    }),
  
  role: Joi.string()
    .valid(...validRoles)
    .required()
    .messages({
      'string.empty': 'Role is required',
      'any.only': 'Invalid role'
    }),
  
  shop: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid shop ID'
    }),
  
  permissions: Joi.array()
    .items(Joi.string().valid(...validPermissions))
    .default([])
    .optional(),
  
  department: Joi.string()
    .max(100)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Department cannot exceed 100 characters'
    }),
  
  isActive: Joi.boolean()
    .default(true)
    .optional()
});

const updateUserValidation = Joi.object({
  name: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Name cannot exceed 100 characters'
    }),
  
  phone: Joi.string()
    .pattern(phonePattern)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'Please enter a valid phone number'
    }),
  
  role: Joi.string()
    .valid(...validRoles)
    .optional()
    .messages({
      'any.only': 'Invalid role'
    }),
  
  shop: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid shop ID'
    }),
  
  permissions: Joi.array()
    .items(Joi.string().valid(...validPermissions))
    .optional(),
  
  department: Joi.string()
    .max(100)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Department cannot exceed 100 characters'
    }),
  
  isActive: Joi.boolean()
    .optional()
});

module.exports = {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  createUserValidation,
  updateUserValidation,
  validPermissions,
  validRoles
};