const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const User = require('../models/User');
const Shop = require('../models/Shop');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/email');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { email, phone, password, role, shop, permissions, ...userData } = req.body;

  console.log(email, phone, password, role, shop, permissions, userData);

  // Validate and sanitize permissions
  let sanitizedPermissions = [];
  
  if (permissions) {
    // Ensure permissions is an array
    if (!Array.isArray(permissions)) {
      return errorResponse(res, 'Permissions must be an array', 400);
    }
    
    // Filter out invalid values and ensure they're strings
    sanitizedPermissions = permissions
      .filter(p => p && typeof p === 'string') // Remove null/undefined/non-string
      .map(p => p.trim()) // Trim whitespace
      .filter(p => p.length > 0) // Remove empty strings
      .filter(p => [
        'manage_users',
        'manage_customers',
        'manage_records',
        'view_reports',
        'manage_inventory',
        'manage_appointments',
        'billing',
        'settings'
      ].includes(p));
    
    // Remove duplicates
    sanitizedPermissions = [...new Set(sanitizedPermissions)];
  }

  // Check if user exists
  const userExists = await User.findOne({ 
    $or: [{ email: email || null }, { phone: phone || null }].filter(condition => {
      const value = Object.values(condition)[0];
      return value !== null && value !== undefined && value !== '';
    })
  });

  if (userExists) {
    return errorResponse(res, 'User already exists', 400);
  }

  // For non-super_admin/non-admin users, validate shop
  if (role && role !== 'super_admin' && role !== 'admin') {
    if (!shop) {
      return errorResponse(res, 'Shop is required for this role', 400);
    }
    
    // Check if shop exists and is active
    const shopExists = await Shop.findById(shop);
    if (!shopExists) {
      return errorResponse(res, 'Shop not found', 404);
    }
    
    if (!shopExists.isActive) {
      return errorResponse(res, 'Shop is not active', 400);
    }
  }

  // Set default permissions based on role if none provided
  if (!sanitizedPermissions || sanitizedPermissions.length === 0) {
    switch (role) {
      case 'shop_owner':
        sanitizedPermissions = [
          'manage_users',
          'manage_customers',
          'manage_records',
          'view_reports',
          'manage_inventory',
          'manage_appointments',
          'billing',
          'settings'
        ];
        break;
      case 'optometrist':
        sanitizedPermissions = [
          'manage_customers',
          'manage_records',
          'view_reports'
        ];
        break;
      case 'assistant':
        sanitizedPermissions = [
          'manage_customers',
          'view_reports'
        ];
        break;
      case 'receptionist':
        sanitizedPermissions = [
          'manage_appointments',
          'billing'
        ];
        break;
      case 'admin':
        sanitizedPermissions = [
          'manage_users',
          'manage_customers',
          'manage_records',
          'view_reports',
          'manage_inventory',
          'manage_appointments',
          'billing',
          'settings'
        ];
        break;
      default:
        sanitizedPermissions = [];
    }
  }

  // Create user
  const user = await User.create({
    email,
    phone,
    password,
    role: role || 'optometrist',
    shop: (role === 'super_admin' || role === 'admin') ? undefined : shop,
    permissions: sanitizedPermissions,
    ...userData,
    createdBy: req.user?._id || null
  });

  // Send welcome email if email is provided
  if (email) {
    try {
      await sendWelcomeEmail(user, password);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail registration if email fails
    }
  }

  const token = generateToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  successResponse(res, {
    token,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      shop: user.shop,
      permissions: user.permissions,
      isActive: user.isActive
    }
  }, 'Registration successful', 201);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, phone, password } = req.body;

  if (!email && !phone) {
    return errorResponse(res, 'Please provide email or phone', 400);
  }

  // Find user by email or phone
  const user = await User.findOne({
    $or: [{ email: email || null }, { phone: phone || null }]
  }).select('+password +refreshToken');

  if (!user) {
    return errorResponse(res, 'Invalid credentials', 401);
  }

  if (!user.isActive) {
    return errorResponse(res, 'Account is deactivated', 401);
  }

  // Check password
  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    return errorResponse(res, 'Invalid credentials', 401);
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // Update refresh token
  user.refreshToken = refreshToken;
  await user.save();

  successResponse(res, {
    token,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      shop: user.shop
    }
  }, 'Login successful');
});

// @desc    Refresh token
// @route   POST /api/auth/refresh-token
// @access  Public
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return errorResponse(res, 'Refresh token is required', 400);
  }

  const user = await User.findOne({ refreshToken });

  if (!user) {
    return errorResponse(res, 'Invalid refresh token', 401);
  }

  // Verify refresh token
  const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

  if (decoded.id !== user._id.toString()) {
    return errorResponse(res, 'Invalid refresh token', 401);
  }

  // Generate new tokens
  const newToken = generateToken(user._id, user.role);
  const newRefreshToken = generateRefreshToken(user._id);

  // Update refresh token
  user.refreshToken = newRefreshToken;
  await user.save();

  successResponse(res, {
    token: newToken,
    refreshToken: newRefreshToken
  }, 'Token refreshed successfully');
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('shop', 'name contact.email contact.phone');

  successResponse(res, { user }, 'User retrieved successfully');
});

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, department } = req.body;
  const userId = req.user._id;

  // Check if phone is being updated and if it's already taken
  if (phone) {
    const phoneExists = await User.findOne({
      phone,
      _id: { $ne: userId }
    });

    if (phoneExists) {
      return errorResponse(res, 'Phone number already in use', 400);
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { name, phone, department },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

  successResponse(res, { user }, 'Profile updated successfully');
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return errorResponse(res, 'Current password is incorrect', 400);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  successResponse(res, null, 'Password changed successfully');
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return errorResponse(res, 'No user found with this email', 404);
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(20).toString('hex');
  const resetTokenExpire = Date.now() + 3600000; // 1 hour

  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  user.resetPasswordExpire = resetTokenExpire;
  await user.save();

  // Send email
  await sendPasswordResetEmail(user, resetToken);

  successResponse(res, null, 'Password reset email sent');
});

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  // Hash token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return errorResponse(res, 'Invalid or expired token', 400);
  }

  // Set new password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  successResponse(res, null, 'Password reset successful');
});

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  if (user) {
    user.refreshToken = null;
    await user.save();
  }

  successResponse(res, null, 'Logged out successfully');
});

module.exports = {
  register,
  login,
  refreshToken,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logout
};