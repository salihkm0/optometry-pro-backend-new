const { validationResult } = require('express-validator');
const { errorResponse } = require('../utils/responseHandler');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

    return errorResponse(res, 'Validation failed', 422, extractedErrors);
  };
};

const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return errorResponse(res, `Invalid ${paramName} ID format`, 400);
    }
    
    next();
  };
};

module.exports = {
  validate,
  validateObjectId
};