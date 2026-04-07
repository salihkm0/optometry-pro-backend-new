const asyncHandler = require('express-async-handler');
const OptometryRecord = require('../models/OptometryRecord');
const Customer = require('../models/Customer');
const Shop = require('../models/Shop');
const User = require('../models/User');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseHandler');

// @desc    Create optometry record
// @route   POST /api/records
// @access  Private (Shop access)
const createRecord = asyncHandler(async (req, res) => {
  const { customer, shop, ...recordData } = req.body;

  // Validate shop access
  const targetShop = shop || req.user.shop;
  
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (!targetShop || targetShop.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Cannot create record for other shops', 403);
    }
  }

  // Validate customer exists and belongs to shop
  const customerDoc = await Customer.findOne({
    _id: customer,
    shop: targetShop
  });

  if (!customerDoc) {
    return errorResponse(res, 'Customer not found or does not belong to this shop', 404);
  }

  // Set createdBy and optometrist if not provided
  if (!recordData.optometrist) {
    if (req.user.role === 'optometrist') {
      recordData.optometrist = req.user._id;
    }
  }

  // Create record
  const record = await OptometryRecord.create({
    shop: targetShop,
    customer,
    ...recordData,
    createdBy: req.user._id
  });

  // Populate related data
  const populatedRecord = await OptometryRecord.findById(record._id)
    .populate('customer', 'name age sex phone customerId')
    .populate('optometrist', 'name role')
    .populate('assistant', 'name role')
    .populate('shop', 'name');

  successResponse(res, { record: populatedRecord }, 'Record created successfully', 201);
});

// @desc    Get all records
// @route   GET /api/records
// @access  Private
const getRecords = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { 
    shop, 
    customer, 
    startDate, 
    endDate, 
    status, 
    examinationType,
    optometrist,
    search  // Add search parameter
  } = req.query;

  let query = {};

  // Apply shop filter
  if (shop) {
    query.shop = shop;
  } else if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    query.shop = req.user.shop;
  }

  // Apply other filters
  if (customer) {
    query.customer = customer;
  }

  if (status) {
    query.status = status;
  }

  if (examinationType) {
    query.examinationType = examinationType;
  }

  if (optometrist) {
    query.optometrist = optometrist;
  }

  // Date range filter
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  // Handle search functionality
  if (search && search.trim() !== '') {
    // First find customers matching the search term
    const customers = await Customer.find({
      shop: query.shop,
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');

    const customerIds = customers.map(c => c._id);

    // Add search conditions to query
    query.$or = [
      { recordId: { $regex: search, $options: 'i' } },
      { customer: { $in: customerIds } },
      { 'billing.invoiceNumber': { $regex: search, $options: 'i' } }
    ];
  }

  const total = await OptometryRecord.countDocuments(query);
  
  let recordsQuery = OptometryRecord.find(query)
    .populate('customer', 'name age sex phone customerId email')
    .populate('optometrist', 'name role')
    .populate('shop', 'name')
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  const records = await recordsQuery;

  const pagination = {
    total,
    page,
    pages: Math.ceil(total / limit),
    limit
  };

  paginatedResponse(res, records, pagination, 'Records retrieved successfully');
});

// @desc    Get record by ID
// @route   GET /api/records/:id
// @access  Private (Shop access)
const getRecordById = asyncHandler(async (req, res) => {
  const record = await OptometryRecord.findById(req.params.id)
    .populate('customer', 'name age sex phone email address medicalHistory customerId')
    .populate('optometrist', 'name email phone role')
    .populate('assistant', 'name email phone role')
    .populate('shop', 'name contact.address')
    .populate('createdBy', 'name email');

  if (!record) {
    return errorResponse(res, 'Record not found', 404);
  }

  // Check shop access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (!record.shop || record.shop._id.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Access denied to this record', 403);
    }
  }

  successResponse(res, { record }, 'Record retrieved successfully');
});

// @desc    Update record
// @route   PUT /api/records/:id
// @access  Private (Shop access)
const updateRecord = asyncHandler(async (req, res) => {
  const updateData = req.body;

  let record = await OptometryRecord.findById(req.params.id);
  if (!record) {
    return errorResponse(res, 'Record not found', 404);
  }

  // Check shop access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (!record.shop || record.shop.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Cannot update record from other shop', 403);
    }
    
    // Only allow updating certain fields based on role
    if (req.user.role !== 'optometrist' && req.user.role !== 'shop_owner') {
      return errorResponse(res, 'Not authorized to update records', 403);
    }
  }

  // Prevent changing customer or shop
  if (updateData.customer || updateData.shop) {
    return errorResponse(res, 'Cannot change customer or shop of a record', 400);
  }

  // Update record
  record = await OptometryRecord.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  )
  .populate('customer', 'name age sex phone')
  .populate('optometrist', 'name role');

  successResponse(res, { record }, 'Record updated successfully');
});

// @desc    Delete record
// @route   DELETE /api/records/:id
// @access  Private (Shop access)
const deleteRecord = asyncHandler(async (req, res) => {
  const record = await OptometryRecord.findById(req.params.id);
  
  if (!record) {
    return errorResponse(res, 'Record not found', 404);
  }

  // Check shop access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (!record.shop || record.shop.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Cannot delete record from other shop', 403);
    }
    
    if (req.user.role !== 'shop_owner') {
      return errorResponse(res, 'Only shop owner can delete records', 403);
    }
  }

  // Use deleteOne() instead of remove()
  await record.deleteOne();
  successResponse(res, null, 'Record deleted successfully');
});

// @desc    Get customer records
// @route   GET /api/customers/:customerId/records
// @access  Private (Shop access)
const getCustomerRecords = asyncHandler(async (req, res) => {
  const { customerId } = req.params;
  const { status, startDate, endDate } = req.query;

  const customer = await Customer.findById(customerId);
  if (!customer) {
    return errorResponse(res, 'Customer not found', 404);
  }

  // Check shop access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (!customer.shop || customer.shop.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Access denied', 403);
    }
  }

  let query = { customer: customerId };

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const records = await OptometryRecord.find(query)
    .populate('optometrist', 'name role')
    .sort({ date: -1 });

  successResponse(res, { records }, 'Customer records retrieved successfully');
});

// @desc    Get shop records statistics
// @route   GET /api/shops/:shopId/records/stats
// @access  Private (Shop access)
const getShopRecordsStats = asyncHandler(async (req, res) => {
  const { shopId } = req.params;
  const { startDate, endDate } = req.query;

  // Validate shop access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (req.user.shop.toString() !== shopId) {
      return errorResponse(res, 'Access denied to this shop', 403);
    }
  }

  const shop = await Shop.findById(shopId);
  if (!shop) {
    return errorResponse(res, 'Shop not found', 404);
  }

  const defaultStartDate = new Date();
  defaultStartDate.setMonth(defaultStartDate.getMonth() - 1);
  
  const stats = await OptometryRecord.getStats(
    shopId,
    startDate ? new Date(startDate) : defaultStartDate,
    endDate ? new Date(endDate) : new Date()
  );

  // Get optometrist performance
  const optometristStats = await OptometryRecord.aggregate([
    {
      $match: {
        shop: shop._id,
        date: {
          $gte: startDate ? new Date(startDate) : defaultStartDate,
          $lte: endDate ? new Date(endDate) : new Date()
        },
        status: 'completed',
        optometrist: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$optometrist',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$billing.amount' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $project: {
        optometristName: '$user.name',
        count: 1,
        totalRevenue: 1,
        averageRevenue: { $divide: ['$totalRevenue', '$count'] }
      }
    },
    {
      $sort: { totalRevenue: -1 }
    }
  ]);

  successResponse(res, {
    shopStats: stats[0] || {},
    optometristStats
  }, 'Shop records statistics retrieved successfully');
});

// @desc    Export records
// @route   GET /api/records/export
// @access  Private
const exportRecords = asyncHandler(async (req, res) => {
  const { shop, startDate, endDate, format = 'json', search } = req.query;

  let query = {};

  // Apply shop filter
  if (shop) {
    query.shop = shop;
  } else if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    query.shop = req.user.shop;
  }

  // Date range filter
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  // Handle search for export
  if (search && search.trim() !== '') {
    const customers = await Customer.find({
      shop: query.shop,
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');

    const customerIds = customers.map(c => c._id);

    query.$or = [
      { recordId: { $regex: search, $options: 'i' } },
      { customer: { $in: customerIds } }
    ];
  }

  const records = await OptometryRecord.find(query)
    .populate('customer', 'name age sex phone email')
    .populate('optometrist', 'name')
    .populate('shop', 'name')
    .sort({ date: -1 });

  if (format === 'csv') {
    // Convert to CSV
    const headers = ['Date', 'Record ID', 'Customer', 'Age', 'Sex', 'Phone', 'Email', 'Examination Type', 'Status', 'Amount', 'Optometrist'];
    const csvData = records.map(record => [
      record.date.toISOString().split('T')[0],
      record.recordId,
      record.customer?.name || 'N/A',
      record.customer?.age || 'N/A',
      record.customer?.sex || 'N/A',
      record.customer?.phone || 'N/A',
      record.customer?.email || 'N/A',
      record.examinationType,
      record.status,
      record.billing?.amount || 0,
      record.optometrist?.name || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=records.csv');
    return res.send(csvContent);
  }

  // Default JSON response
  successResponse(res, { records }, 'Records exported successfully');
});

module.exports = {
  createRecord,
  getRecords,
  getRecordById,
  updateRecord,
  deleteRecord,
  getCustomerRecords,
  getShopRecordsStats,
  exportRecords
};