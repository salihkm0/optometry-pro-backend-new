const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Shop = require('../models/Shop');
const { sendWelcomeEmail } = require('../utils/email');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseHandler');

// @desc    Create user (by admin/shop owner)
// @route   POST /api/users
// @access  Private
const createUser = asyncHandler(async (req, res) => {
  const { email, phone, password, role, shop, permissions, ...userData } = req.body;

  // Validate shop access
  if (shop) {
    const shopExists = await Shop.findById(shop);
    if (!shopExists) {
      return errorResponse(res, 'Shop not found', 404);
    }

    // Check if user has access to this shop
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      if (req.user.shop.toString() !== shop) {
        return errorResponse(res, 'Cannot create user for other shops', 403);
      }
    }
  }

  // Check if user exists
  const userExists = await User.findOne({
    $or: [{ email }, { phone }]
  });

  if (userExists) {
    return errorResponse(res, 'User already exists', 400);
  }

  // Validate role hierarchy
  const validRoles = ['shop_owner', 'optometrist', 'assistant', 'receptionist'];
  if (req.user.role === 'shop_owner') {
    if (role === 'shop_owner') {
      return errorResponse(res, 'Cannot create another shop owner', 403);
    }
  } else if (req.user.role === 'admin') {
    if (!['admin', 'shop_owner', 'optometrist', 'assistant', 'receptionist'].includes(role)) {
      return errorResponse(res, 'Invalid role for admin to create', 400);
    }
  } else if (req.user.role !== 'super_admin') {
    if (!validRoles.includes(role)) {
      return errorResponse(res, 'Invalid role', 400);
    }
  }

  // Create user
  const user = await User.create({
    email,
    phone,
    password: password || 'default123', // Generate default password
    role,
    shop,
    permissions,
    ...userData,
    createdBy: req.user._id
  });

  // Send welcome email
  if (email) {
    await sendWelcomeEmail(user, password || 'default123');
  }

  successResponse(res, { user }, 'User created successfully', 201);
});

// @desc    Get all users
// @route   GET /api/users
// @access  Private
const getUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search, role, shop, isActive } = req.query;

  let query = {};

  // Apply filters
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  if (role) {
    query.role = role;
  }

  if (shop) {
    query.shop = shop;
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  // Filter by accessible users based on role
  if (req.user.role === 'super_admin') {
    // Super admin can see all except other super admins
    query.role = { $ne: 'super_admin' };
  } else if (req.user.role === 'admin') {
    // Admin can see all except super admins
    query.role = { $ne: 'super_admin' };
  } else if (req.user.role === 'shop_owner') {
    // Shop owner can only see users in their shop
    query.shop = req.user.shop;
    query.role = { $ne: 'shop_owner' }; // Can't see other shop owners
  } else {
    // Other users can only see users in their shop (excluding themselves)
    query.shop = req.user.shop;
    query._id = { $ne: req.user._id };
  }

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .populate('shop', 'name')
    .populate('createdBy', 'name')
    .select('-password -refreshToken')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const pagination = {
    total,
    page,
    pages: Math.ceil(total / limit),
    limit
  };

  paginatedResponse(res, users, pagination, 'Users retrieved successfully');
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .populate('shop', 'name contact.email contact.phone')
    .populate('createdBy', 'name email')
    .select('-password -refreshToken');

  if (!user) {
    return errorResponse(res, 'User not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'super_admin') {
    // Super admin can access all
  } else if (req.user.role === 'admin') {
    // Admin cannot access super admins
    if (user.role === 'super_admin') {
      return errorResponse(res, 'Access denied', 403);
    }
  } else if (req.user.role === 'shop_owner') {
    // Shop owner can only access users in their shop
    if (!user.shop || user.shop._id.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Access denied', 403);
    }
    if (user.role === 'shop_owner' && user._id.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'Cannot access other shop owners', 403);
    }
  } else {
    // Regular users can only access themselves or users in their shop
    if (user._id.toString() !== req.user._id.toString()) {
      if (!user.shop || user.shop._id.toString() !== req.user.shop.toString()) {
        return errorResponse(res, 'Access denied', 403);
      }
    }
  }

  successResponse(res, { user }, 'User retrieved successfully');
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
const updateUser = asyncHandler(async (req, res) => {
  const { name, phone, role, permissions, isActive, department } = req.body;

  let user = await User.findById(req.params.id);
  if (!user) {
    return errorResponse(res, 'User not found', 404);
  }

  // Check permissions
  if (req.user.role === 'super_admin') {
    // Super admin can update anyone
  } else if (req.user.role === 'admin') {
    // Admin cannot update super admins
    if (user.role === 'super_admin') {
      return errorResponse(res, 'Cannot update super admin', 403);
    }
  } else if (req.user.role === 'shop_owner') {
    // Shop owner can only update users in their shop
    if (!user.shop || user.shop.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Cannot update user from other shop', 403);
    }
    if (user.role === 'shop_owner' && user._id.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'Cannot update other shop owners', 403);
    }
    // Shop owner cannot change role to shop_owner
    if (role && role === 'shop_owner') {
      return errorResponse(res, 'Cannot assign shop owner role', 403);
    }
  } else {
    // Regular users can only update themselves
    if (user._id.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'Can only update your own profile', 403);
    }
    // Regular users cannot change their role or permissions
    if (role || permissions) {
      return errorResponse(res, 'Cannot change role or permissions', 403);
    }
  }

  // Check for duplicate phone
  if (phone && phone !== user.phone) {
    const phoneExists = await User.findOne({
      phone,
      _id: { $ne: user._id }
    });
    if (phoneExists) {
      return errorResponse(res, 'Phone number already in use', 400);
    }
  }

  // Update user
  user = await User.findByIdAndUpdate(
    req.params.id,
    { name, phone, role, permissions, isActive, department },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

  successResponse(res, { user }, 'User updated successfully');
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return errorResponse(res, 'User not found', 404);
  }

  // Check permissions
  if (req.user.role === 'super_admin') {
    // Super admin can delete anyone except themselves
    if (user._id.toString() === req.user._id.toString()) {
      return errorResponse(res, 'Cannot delete yourself', 400);
    }
  } else if (req.user.role === 'admin') {
    // Admin cannot delete super admins or themselves
    if (user.role === 'super_admin') {
      return errorResponse(res, 'Cannot delete super admin', 403);
    }
    if (user._id.toString() === req.user._id.toString()) {
      return errorResponse(res, 'Cannot delete yourself', 400);
    }
  } else if (req.user.role === 'shop_owner') {
    // Shop owner can only delete users in their shop (not themselves or other owners)
    if (!user.shop || user.shop.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Cannot delete user from other shop', 403);
    }
    if (user.role === 'shop_owner') {
      return errorResponse(res, 'Cannot delete shop owner', 403);
    }
  } else {
    // Regular users cannot delete anyone
    return errorResponse(res, 'Not authorized to delete users', 403);
  }

  await user.remove();
  successResponse(res, null, 'User deleted successfully');
});

// @desc    Get shop users
// @route   GET /api/users/shop/:shopId
// @access  Private (Shop access)
const getShopUsers = asyncHandler(async (req, res) => {
  const { shopId } = req.params;
  
  // Validate shop access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (req.user.shop.toString() !== shopId) {
      return errorResponse(res, 'Access denied to this shop', 403);
    }
  }

  const users = await User.find({ shop: shopId, isActive: true })
    .select('name email phone role department lastLogin')
    .sort({ role: 1, name: 1 });

  successResponse(res, { users }, 'Shop users retrieved successfully');
});

// @desc    Reset user password (by admin)
// @route   PUT /api/users/:id/reset-password
// @access  Private (Admin/Shop Owner)
const resetUserPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  const userId = req.params.id;

  const user = await User.findById(userId);
  if (!user) {
    return errorResponse(res, 'User not found', 404);
  }

  // Check permissions
  if (req.user.role === 'shop_owner') {
    if (!user.shop || user.shop.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Cannot reset password for user from other shop', 403);
    }
    if (user.role === 'shop_owner') {
      return errorResponse(res, 'Cannot reset password for shop owner', 403);
    }
  } else if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return errorResponse(res, 'Not authorized', 403);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  successResponse(res, null, 'Password reset successfully');
});

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getShopUsers,
  resetUserPassword
};