const asyncHandler = require('express-async-handler');
const Customer = require('../models/Customer');
const OptometryRecord = require('../models/OptometryRecord');
const Shop = require('../models/Shop');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseHandler');

// @desc    Create customer
// @route   POST /api/customers
// @access  Private (Shop access)
const createCustomer = asyncHandler(async (req, res) => {
  const { shop, phone, email, ...customerData } = req.body;

  // Validate shop access
  const targetShop = shop || req.user.shop;
  
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (!targetShop || targetShop.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Cannot create customer for other shops', 403);
    }
  }

  // Check for duplicate phone with same name (optional warning)
  if (phone) {
    const existingCustomersWithPhone = await Customer.find({
      shop: targetShop,
      phone
    });
    
    if (existingCustomersWithPhone.length > 0) {
      // Check if customer with same name already exists
      const duplicateByName = existingCustomersWithPhone.some(
        c => c.name.toLowerCase() === customerData.name?.toLowerCase()
      );
      
      if (duplicateByName) {
        return errorResponse(res, 'Customer with this name and phone already exists in this shop', 400);
      }
      
      // Optional: Add warning about family member (you can still create)
      console.log(`Warning: Adding customer with phone ${phone} that is shared with ${existingCustomersWithPhone.length} existing customer(s)`);
    }
  }

  // Check for duplicate email (emails should be unique per person)
  if (email) {
    const existingCustomer = await Customer.findOne({
      shop: targetShop,
      email
    });

    if (existingCustomer) {
      return errorResponse(res, 'Customer with this email already exists in this shop', 400);
    }
  }

  // Create customer
  const customer = await Customer.create({
    shop: targetShop,
    phone,
    email,
    ...customerData,
    createdBy: req.user._id
  });

  successResponse(res, { customer }, 'Customer created successfully', 201);
});

// @desc    Get family members of a customer
// @route   GET /api/customers/:id/family
// @access  Private (Shop access)
const getFamilyMembers = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const targetShop = req.user.shop;

  // Find the customer first
  const customer = await Customer.findOne({
    _id: id,
    shop: targetShop
  }).populate('createdBy', 'name email');

  if (!customer) {
    return errorResponse(res, 'Customer not found', 404);
  }

  // Find all family members sharing the same phone number
  const familyMembers = await Customer.find({
    shop: targetShop,
    phone: customer.phone,
    isActive: true
  })
  .select('customerId name phone email sex age dateOfBirth relationship familyHead createdAt')
  .populate('createdBy', 'name');

  // Separate the primary customer from family members
  const primaryCustomer = familyMembers.find(m => m._id.toString() === customer._id.toString());
  const otherFamilyMembers = familyMembers.filter(m => m._id.toString() !== customer._id.toString());

  successResponse(res, {
    primaryCustomer: primaryCustomer,
    familyMembers: otherFamilyMembers,
    totalFamilyMembers: familyMembers.length,
    sharedPhone: customer.phone
  }, 'Family members retrieved successfully');
});

// @desc    Update customer with family relationship
// @route   PUT /api/customers/:id/family
// @access  Private (Shop access)
const updateCustomerWithFamily = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { relationship, familyHeadId, familyRole } = req.body;
  const targetShop = req.user.shop;

  const customer = await Customer.findOne({
    _id: id,
    shop: targetShop
  });

  if (!customer) {
    return errorResponse(res, 'Customer not found', 404);
  }

  // Add family relationship fields
  const updateFields = {};
  
  if (relationship) {
    updateFields.relationship = relationship;
  }
  
  if (familyHeadId) {
    // Verify family head exists and shares same phone
    const familyHead = await Customer.findOne({
      _id: familyHeadId,
      shop: targetShop,
      phone: customer.phone
    });
    
    if (!familyHead) {
      return errorResponse(res, 'Family head not found or does not share the same phone number', 400);
    }
    updateFields.familyHead = familyHeadId;
  }
  
  if (familyRole) {
    updateFields.familyRole = familyRole;
  }

  // Update customer
  const updatedCustomer = await Customer.findByIdAndUpdate(
    id,
    updateFields,
    { new: true, runValidators: true }
  ).select('customerId name phone email relationship familyHead familyRole');

  successResponse(res, { 
    customer: updatedCustomer,
    message: relationship ? 'Family relationship updated successfully' : 'Customer family information updated successfully'
  });
});

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
const getCustomers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search, shop, isActive, sex, tags } = req.query;

  let query = {};

  // Apply shop filter
  if (shop) {
    query.shop = shop;
  } else if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    query.shop = req.user.shop;
  }

  // Apply search
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { customerId: { $regex: search, $options: 'i' } }
    ];
  }

  // Apply filters
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (sex) {
    query.sex = sex;
  }

  if (tags) {
    const tagArray = tags.split(',');
    query.tags = { $in: tagArray };
  }

  const total = await Customer.countDocuments(query);
  const customers = await Customer.find(query)
    .populate('shop', 'name')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const pagination = {
    total,
    page,
    pages: Math.ceil(total / limit),
    limit
  };

  paginatedResponse(res, customers, pagination, 'Customers retrieved successfully');
});

// @desc    Get customer by ID
// @route   GET /api/customers/:id
// @access  Private (Shop access)
const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id)
    .populate('shop', 'name contact.email contact.phone')
    .populate('createdBy', 'name email');

  if (!customer) {
    return errorResponse(res, 'Customer not found', 404);
  }

  // Check shop access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (!customer.shop || customer.shop._id.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Access denied to this customer', 403);
    }
  }

  // Get customer's records
  const records = await OptometryRecord.find({ customer: customer._id })
    .sort({ date: -1 })
    .limit(10);

  // Get family members count
  const familyMembersCount = await Customer.countDocuments({
    shop: customer.shop,
    phone: customer.phone,
    isActive: true
  });

  successResponse(res, { 
    customer, 
    recentRecords: records,
    familyMembersCount: familyMembersCount > 1 ? familyMembersCount - 1 : 0
  }, 'Customer retrieved successfully');
});

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private (Shop access)
const updateCustomer = asyncHandler(async (req, res) => {
  const { phone, email, ...updateData } = req.body;

  let customer = await Customer.findById(req.params.id);
  if (!customer) {
    return errorResponse(res, 'Customer not found', 404);
  }

  // Check shop access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (!customer.shop || customer.shop.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Cannot update customer from other shop', 403);
    }
  }

  // Check for duplicate phone - but allow if it's for family sharing
  if (phone && phone !== customer.phone) {
    const phoneExists = await Customer.findOne({
      shop: customer.shop,
      phone,
      _id: { $ne: customer._id }
    });
    if (phoneExists) {
      // Instead of blocking, just warn about family sharing
      console.log(`Warning: Updating customer phone to ${phone} which is shared with ${phoneExists.name}`);
      // You can still proceed with the update
    }
  }

  // Check for duplicate email (still unique per customer)
  if (email && email !== customer.email) {
    const emailExists = await Customer.findOne({
      shop: customer.shop,
      email,
      _id: { $ne: customer._id }
    });
    if (emailExists) {
      return errorResponse(res, 'Email already exists in this shop', 400);
    }
  }

  // Update customer
  customer = await Customer.findByIdAndUpdate(
    req.params.id,
    { phone, email, ...updateData },
    { new: true, runValidators: true }
  );

  successResponse(res, { customer }, 'Customer updated successfully');
});

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private (Shop access)
const deleteCustomer = asyncHandler(async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }

    // Check shop access
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      if (!customer.shop || customer.shop.toString() !== req.user.shop.toString()) {
        return errorResponse(res, 'Cannot delete customer from other shop', 403);
      }
    }

    // Check if customer has records
    const hasRecords = await OptometryRecord.exists({ customer: customer._id });
    if (hasRecords) {
      // Soft delete by deactivating
      customer.isActive = false;
      await customer.save();
      return successResponse(res, null, 'Customer deactivated (has existing records)', 200);
    }

    // Delete customer
    await Customer.findByIdAndDelete(req.params.id);
    
    return successResponse(res, null, 'Customer deleted successfully', 200);
  } catch (error) {
    console.error('Delete customer error:', error);
    return errorResponse(res, 'Failed to delete customer', 500);
  }
});

// @desc    Search customers
// @route   GET /api/customers/search
// @access  Private (Shop access)
const searchCustomers = asyncHandler(async (req, res) => {
  const { q, shopId } = req.query;
  
  if (!q) {
    return errorResponse(res, 'Search query is required', 400);
  }

  const targetShop = shopId || req.user.shop;
  
  // Check shop access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (!targetShop || targetShop.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Access denied', 403);
    }
  }

  const customers = await Customer.searchCustomers(targetShop, q);
  successResponse(res, { customers }, 'Search results retrieved');
});

// @desc    Get customer statistics
// @route   GET /api/customers/:id/stats
// @access  Private (Shop access)
const getCustomerStats = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  
  if (!customer) {
    return errorResponse(res, 'Customer not found', 404);
  }

  // Check shop access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (!customer.shop || customer.shop.toString() !== req.user.shop.toString()) {
      return errorResponse(res, 'Access denied', 403);
    }
  }

  // Get total records
  const totalRecords = await OptometryRecord.countDocuments({
    customer: customer._id,
    status: 'completed'
  });

  // Get first and last visit
  const firstRecord = await OptometryRecord.findOne({ customer: customer._id })
    .sort({ date: 1 })
    .select('date');
  
  const lastRecord = await OptometryRecord.findOne({ customer: customer._id })
    .sort({ date: -1 })
    .select('date');

  // Get prescription history
  const prescriptions = await OptometryRecord.find({
    customer: customer._id,
    status: 'completed'
  })
  .select('date right_eye left_eye prescriptionType')
  .sort({ date: -1 })
  .limit(20);

  // Get family members
  const familyMembers = await Customer.find({
    shop: customer.shop,
    phone: customer.phone,
    isActive: true,
    _id: { $ne: customer._id }
  }).select('name relationship');

  successResponse(res, {
    totalRecords,
    firstVisit: firstRecord?.date,
    lastVisit: lastRecord?.date,
    prescriptions,
    familyMembers: familyMembers,
    totalFamilyMembers: familyMembers.length
  }, 'Customer statistics retrieved');
});

// @desc    Get shop customers
// @route   GET /api/shops/:shopId/customers
// @access  Private (Shop access)
const getShopCustomers = asyncHandler(async (req, res) => {
  const { shopId } = req.params;
  
  // Validate shop access
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    if (req.user.shop.toString() !== shopId) {
      return errorResponse(res, 'Access denied to this shop', 403);
    }
  }

  const customers = await Customer.find({ shop: shopId, isActive: true })
    .select('customerId name phone email age sex lastVisit totalVisits')
    .sort({ name: 1 });

  successResponse(res, { customers }, 'Shop customers retrieved successfully');
});

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
  getCustomerStats,
  getShopCustomers,
  getFamilyMembers,           // Export new function
  updateCustomerWithFamily    // Export new function
};