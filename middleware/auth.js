const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { errorResponse } = require('../utils/responseHandler');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password -refreshToken');
      
      if (!req.user) {
        return errorResponse(res, 'User not found', 401);
      }
      
      if (!req.user.isActive) {
        return errorResponse(res, 'User account is deactivated', 401);
      }
      
      next();
    } catch (error) {
      return errorResponse(res, 'Not authorized, token failed', 401);
    }
  }

  if (!token) {
    return errorResponse(res, 'Not authorized, no token', 401);
  }
});

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Not authorized', 401);
    }
    
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, `Role ${req.user.role} is not authorized to access this route`, 403);
    }
    
    next();
  };
};

const shopAccess = (requiredPermission = null) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      // Super admin can access everything
      if (user.role === 'super_admin') {
        return next();
      }
      
      // Check if user has access to the requested shop
      const shopId = req.params.shopId || req.body.shop || req.query.shop || req.params.id;
      
      if (!shopId) {
        return errorResponse(res, 'Shop ID is required', 400);
      }
      
      // Admin users can access all shops
      if (user.role === 'admin') {
        req.shopId = shopId;
        return next();
      }
      
      // Shop users must belong to the shop
      if (user.shop && user.shop.toString() === shopId.toString()) {
        // Check permission if required
        if (requiredPermission && !user.hasPermission(requiredPermission)) {
          return errorResponse(res, 'Insufficient permissions', 403);
        }
        req.shopId = shopId;
        return next();
      }
      
      return errorResponse(res, 'Access denied to this shop', 403);
    } catch (error) {
      return errorResponse(res, 'Access validation error', 500);
    }
  };
};

const validateUserShop = (req, res, next) => {
  // For non-admin users, ensure they're only accessing their own shop data
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (req.body.shop && req.body.shop !== req.user.shop.toString()) {
      return errorResponse(res, 'Cannot modify data from other shops', 403);
    }
  }
  next();
};

module.exports = {
  protect,
  authorize,
  shopAccess,
  validateUserShop
};