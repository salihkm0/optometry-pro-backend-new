const asyncHandler = require('express-async-handler');
const Shop = require('../models/Shop');
const User = require('../models/User');
const Customer = require('../models/Customer');
const OptometryRecord = require('../models/OptometryRecord');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseHandler');
const mongoose = require('mongoose'); 

// @desc    Create new shop with owner
// @route   POST /api/shops
// @access  Private (Admin only)
const createShop = asyncHandler(async (req, res) => {
  const { name, contact, settings, subscription, owner } = req.body;
  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if shop with same email or phone exists
    const existingShop = await Shop.findOne({
      $or: [
        { 'contact.email': contact.email },
        { 'contact.phone': contact.phone }
      ]
    }).session(session);

    if (existingShop) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 'Shop with this email or phone already exists', 400);
    }

    // Check if owner email already exists
    const existingUser = await User.findOne({
      $or: [
        { email: owner.email },
        { phone: owner.phone }
      ]
    }).session(session);

    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 'Owner email or phone already registered', 400);
    }

    // Create shop (temporarily without owner if needed)
    const shop = new Shop({
      name,
      contact,
      settings: settings || {},
      subscription: subscription || { plan: 'free' },
      createdBy: req.user._id
    });

    await shop.save({ session });

    // Create shop owner with shop reference
    const ownerUser = new User({
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      password: owner.password,
      role: 'shop_owner',
      shop: shop._id,
      createdBy: req.user._id
    });

    await ownerUser.save({ session });

    // Update shop with owner reference
    shop.owner = ownerUser._id;
    await shop.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Populate shop data
    const populatedShop = await Shop.findById(shop._id)
      .populate('owner', 'name email phone role');

    successResponse(res, { shop: populatedShop }, 'Shop created successfully', 201);

  } catch (error) {
    // If anything fails, rollback
    await session.abortTransaction();
    session.endSession();
    
    console.error('Shop creation error:', error);
    return errorResponse(res, 'Failed to create shop', 500);
  }
});

// @desc    Get all shops (for admin)
// @route   GET /api/shops
// @access  Private (Admin only)
const getShops = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search, isActive } = req.query;

  let query = {};

  // Apply filters
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { 'contact.email': { $regex: search, $options: 'i' } },
      { 'contact.phone': { $regex: search, $options: 'i' } }
    ];
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  // If not super admin, filter by accessible shops
  if (req.user.role !== 'super_admin') {
    const accessibleShops = await req.user.getAccessibleShops();
    const shopIds = accessibleShops.map(shop => shop._id);
    query._id = { $in: shopIds };
  }

  const total = await Shop.countDocuments(query);
  const shops = await Shop.find(query)
    .populate('owner', 'name email phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const pagination = {
    total,
    page,
    pages: Math.ceil(total / limit),
    limit
  };

  paginatedResponse(res, shops, pagination, 'Shops retrieved successfully');
});

// @desc    Get shop by ID
// @route   GET /api/shops/:id
// @access  Private (Shop access)
const getShopById = asyncHandler(async (req, res) => {
  const shop = await Shop.findById(req.params.id)
    .populate('owner', 'name email phone role')
    .populate('createdBy', 'name email');

  if (!shop) {
    return errorResponse(res, 'Shop not found', 404);
  }

  // Check access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (req.user.shop.toString() !== shop._id.toString()) {
      return errorResponse(res, 'Access denied', 403);
    }
  }

  successResponse(res, { shop }, 'Shop retrieved successfully');
});

// @desc    Update shop
// @route   PUT /api/shops/:id
// @access  Private (Shop owner/Admin)
const updateShop = asyncHandler(async (req, res) => {
  const { name, contact, isActive, settings } = req.body;

  let shop = await Shop.findById(req.params.id);

  if (!shop) {
    return errorResponse(res, 'Shop not found', 404);
  }

  // Check permissions
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (req.user.role !== 'shop_owner' || req.user.shop.toString() !== shop._id.toString()) {
      return errorResponse(res, 'Not authorized to update this shop', 403);
    }
  }

  // Check for duplicate email/phone
  if (contact && (contact.email || contact.phone)) {
    const duplicateQuery = {
      _id: { $ne: shop._id },
      $or: []
    };

    if (contact.email) {
      duplicateQuery.$or.push({ 'contact.email': contact.email });
    }

    if (contact.phone) {
      duplicateQuery.$or.push({ 'contact.phone': contact.phone });
    }

    if (duplicateQuery.$or.length > 0) {
      const duplicate = await Shop.findOne(duplicateQuery);
      if (duplicate) {
        return errorResponse(res, 'Shop with this email or phone already exists', 400);
      }
    }
  }

  // Update shop
  shop = await Shop.findByIdAndUpdate(
    req.params.id,
    { name, contact, isActive, settings },
    { new: true, runValidators: true }
  ).populate('owner', 'name email phone');

  successResponse(res, { shop }, 'Shop updated successfully');
});

// @desc    Get shop statistics
// @route   GET /api/shops/:id/stats
// @access  Private (Shop access)
const getShopStats = asyncHandler(async (req, res) => {
  const shopId = req.params.id;

  console.log("shopId : ", shopId)

  // Check access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (req.user.shop.toString() !== shopId) {
      return errorResponse(res, 'Access denied', 403);
    }
  }

  const shop = await Shop.findById(shopId);
  if (!shop) {
    return errorResponse(res, 'Shop not found', 404);
  }

  // Get counts
  const [customerCount, userCount, recordCount] = await Promise.all([
    Customer.countDocuments({ shop: shopId, isActive: true }),
    User.countDocuments({ shop: shopId, isActive: true }),
    OptometryRecord.countDocuments({ shop: shopId, status: 'completed' })
  ]);

  // Get recent records
  const recentRecords = await OptometryRecord.find({ shop: shopId })
    .populate('customer', 'name')
    .sort({ date: -1 })
    .limit(5);

  // Get monthly statistics for the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyStats = await OptometryRecord.aggregate([
    {
      $match: {
        shop: shop._id,
        date: { $gte: sixMonthsAgo },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' }
        },
        count: { $sum: 1 },
        revenue: { $sum: '$billing.amount' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    },
    {
      $limit: 6
    }
  ]);

  successResponse(res, {
    customerCount,
    userCount,
    recordCount,
    recentRecords,
    monthlyStats
  }, 'Shop statistics retrieved successfully');
});

// @desc    Get shops with statistics (for admin dashboard)
// @route   GET /api/shops/dashboard/stats
// @access  Private (Admin only)
const getDashboardStats = asyncHandler(async (req, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return errorResponse(res, 'Not authorized', 403);
  }

  const totalShops = await Shop.countDocuments();
  const activeShops = await Shop.countDocuments({ isActive: true });
  const totalCustomers = await Customer.countDocuments();
  const totalUsers = await User.countDocuments({ role: { $ne: 'super_admin' } });
  const totalRecords = await OptometryRecord.countDocuments();

  // Get recent shops
  const recentShops = await Shop.find()
    .populate('owner', 'name email')
    .sort({ createdAt: -1 })
    .limit(5);

  successResponse(res, {
    totalShops,
    activeShops,
    totalCustomers,
    totalUsers,
    totalRecords,
    recentShops
  }, 'Dashboard statistics retrieved successfully');
});

// @desc    Deactivate shop
// @route   PUT /api/shops/:id/deactivate
// @access  Private (Admin only)
const deactivateShop = asyncHandler(async (req, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return errorResponse(res, 'Not authorized', 403);
  }

  const shop = await Shop.findById(req.params.id);
  if (!shop) {
    return errorResponse(res, 'Shop not found', 404);
  }

  shop.isActive = false;
  await shop.save();

  // Deactivate all users in the shop
  await User.updateMany(
    { shop: shop._id },
    { isActive: false }
  );

  successResponse(res, null, 'Shop deactivated successfully');
});

// @desc    Activate shop
// @route   PUT /api/shops/:id/activate
// @access  Private (Admin only)
const activateShop = asyncHandler(async (req, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return errorResponse(res, 'Not authorized', 403);
  }

  const shop = await Shop.findById(req.params.id);
  if (!shop) {
    return errorResponse(res, 'Shop not found', 404);
  }

  shop.isActive = true;
  await shop.save();

  successResponse(res, null, 'Shop activated successfully');
});

module.exports = {
  createShop,
  getShops,
  getShopById,
  updateShop,
  getShopStats,
  getDashboardStats,
  deactivateShop,
  activateShop
};