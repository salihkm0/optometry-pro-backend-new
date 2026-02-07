const Joi = require('joi');

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    // For query validation, convert empty strings to undefined
    if (property === 'query') {
      Object.keys(req.query).forEach(key => {
        if (req.query[key] === '') {
          req.query[key] = undefined;
        }
      });
    }
    
    const { error } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, '')
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    next();
  };
};

const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} ID format`
      });
    }
    
    next();
  };
};

module.exports = {
  validate,
  validateObjectId
};