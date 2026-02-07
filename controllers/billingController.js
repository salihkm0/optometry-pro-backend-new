const Billing = require('../models/Billing');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');

// @desc    Create new bill
// @route   POST /api/billing
// @access  Private
exports.createBill = async (req, res) => {
  try {
    const { customer: customerId, optometrist, ...billingData } = req.body;
    
    // Verify customer exists and belongs to shop
    const customer = await Customer.findOne({
      _id: customerId,
      shop: req.user.shop
    });
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    // Calculate totals
    const subtotal = billingData.products.reduce((sum, product) => sum + (product.mrp * product.quantity), 0);
    const productDiscount = billingData.products.reduce((sum, product) => sum + (product.discount || 0), 0);
    const additionalDiscount = billingData.additionalDiscount || 0;
    const totalDiscount = productDiscount + additionalDiscount;
    const totalTax = billingData.products.reduce((sum, product) => sum + (product.taxAmount || 0), 0);
    const finalAmount = billingData.products.reduce((sum, product) => sum + (product.total || 0), 0);
    
    // Generate invoice number manually
    const shop = await mongoose.model('Shop').findById(req.user.shop);
    const count = await Billing.countDocuments({
      shop: req.user.shop,
      invoiceDate: {
        $gte: new Date(new Date().getFullYear(), 0, 1),
        $lt: new Date(new Date().getFullYear() + 1, 0, 1)
      }
    });
    const year = new Date().getFullYear().toString().substr(-2);
    const invoiceNumber = `INV-${shop?.name?.substring(0, 3).toUpperCase() || 'SHP'}${year}${(count + 1).toString().padStart(5, '0')}`;
    
    // Set due date if not provided (30 days from invoice date)
    let dueDate = billingData.dueDate || new Date(billingData.invoiceDate || Date.now());
    if (!billingData.dueDate) {
      dueDate = new Date(billingData.invoiceDate || Date.now());
      dueDate.setDate(dueDate.getDate() + 30);
    }
    
    // Create bill with all required fields
    const billData = {
      ...billingData,
      shop: req.user.shop,
      customer: customerId,
      optometrist: optometrist || null,
      createdBy: req.user._id,
      invoiceNumber,
      dueDate,
      subtotal,
      totalDiscount,
      totalTax,
      finalAmount,
      payment: {
        ...billingData.payment,
        amount: billingData.payment?.amount || finalAmount,
        status: (billingData.payment?.amount || finalAmount) >= finalAmount ? 'paid' : 
                (billingData.payment?.amount || 0) > 0 ? 'partial' : 'pending'
      }
    };
    
    const bill = await Billing.create(billData);
    
    // Populate customer details
    await bill.populate('customer', 'name phone email customerId');
    if (bill.optometrist) {
      await bill.populate('optometrist', 'name email');
    }
    
    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: bill
    });
  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all bills with pagination and filtering
// @route   GET /api/billing
// @access  Private
exports.getBills = async (req, res) => {
  try {
    const {
      search = '',
      customer,
      startDate,
      endDate,
      status,
      paymentStatus,
      page = 1,
      limit = 20
    } = req.query;
    
    const query = { shop: req.user.shop };
    
    // Search by invoice number or customer name
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by customer
    if (customer) {
      query.customer = customer;
    }
    
    // Filter by date range
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Filter by payment status
    if (paymentStatus) {
      query['payment.status'] = paymentStatus;
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Get total count
    const total = await Billing.countDocuments(query);
    
    // Get bills with pagination
    const bills = await Billing.find(query)
      .populate('customer', 'name phone email customerId')
      .populate('optometrist', 'name email')
      .sort({ invoiceDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();
    
    // Calculate summary statistics
    const stats = await Billing.aggregate([
      {
        $match: {
          shop: req.user.shop,
          status: { $in: ['generated', 'paid'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' },
          totalBills: { $sum: 1 },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ['$payment.status', 'paid'] }, '$finalAmount', 0]
            }
          },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ['$payment.status', 'pending'] }, '$finalAmount', 0]
            }
          },
          totalPartial: {
            $sum: {
              $cond: [{ $eq: ['$payment.status', 'partial'] }, '$finalAmount', 0]
            }
          }
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        bills,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        stats: stats[0] || {
          totalRevenue: 0,
          totalBills: 0,
          totalPaid: 0,
          totalPending: 0,
          totalPartial: 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get bill by ID
// @route   GET /api/billing/:id
// @access  Private
exports.getBillById = async (req, res) => {
  try {
    const bill = await Billing.findOne({
      _id: req.params.id,
      shop: req.user.shop
    })
    .populate('customer')
    .populate('optometrist', 'name email')
    .populate('prescription')
    .populate('createdBy', 'name email');
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }
    
    // Get payment history for this bill
    const payments = await Payment.find({
      invoice: bill._id
    }).sort({ date: -1 });
    
    res.status(200).json({
      success: true,
      data: {
        bill,
        payments
      }
    });
  } catch (error) {
    console.error('Error fetching bill:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update bill
// @route   PUT /api/billing/:id
// @access  Private
exports.updateBill = async (req, res) => {
  try {
    const bill = await Billing.findOne({
      _id: req.params.id,
      shop: req.user.shop,
      status: { $in: ['draft', 'generated'] }
    });
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found or cannot be updated'
      });
    }
    
    // Update bill
    Object.keys(req.body).forEach(key => {
      if (key !== 'shop' && key !== 'customer') {
        bill[key] = req.body[key];
      }
    });
    
    // Recalculate totals if products are updated
    if (req.body.products) {
      bill.subtotal = req.body.products.reduce((sum, product) => sum + (product.mrp * product.quantity), 0);
      bill.totalDiscount = req.body.products.reduce((sum, product) => sum + (product.discount || 0), 0) + (bill.additionalDiscount || 0);
      bill.totalTax = req.body.products.reduce((sum, product) => sum + (product.taxAmount || 0), 0);
      bill.finalAmount = req.body.products.reduce((sum, product) => sum + (product.total || 0), 0);
    }
    
    bill.updatedBy = req.user._id;
    
    await bill.save();
    
    // Re-populate
    await bill.populate('customer', 'name phone email customerId');
    if (bill.optometrist) {
      await bill.populate('optometrist', 'name email');
    }
    
    res.status(200).json({
      success: true,
      message: 'Bill updated successfully',
      data: bill
    });
  } catch (error) {
    console.error('Error updating bill:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete/Cancel bill
// @route   DELETE /api/billing/:id
// @access  Private
exports.deleteBill = async (req, res) => {
  try {
    const bill = await Billing.findOne({
      _id: req.params.id,
      shop: req.user.shop,
      status: { $in: ['draft', 'generated'] }
    });
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found or cannot be cancelled'
      });
    }
    
    // Check if payments have been made
    if (bill.payment.status === 'paid' || bill.payment.status === 'partial') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel bill with payments. Process refund instead.'
      });
    }
    
    // Mark as cancelled
    bill.status = 'cancelled';
    bill.payment.status = 'cancelled';
    bill.updatedBy = req.user._id;
    
    await bill.save();
    
    res.status(200).json({
      success: true,
      message: 'Bill cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling bill:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update payment for bill
// @route   PUT /api/billing/:id/payment
// @access  Private
exports.updatePayment = async (req, res) => {
  try {
    const { amount, method, transactionId, paymentDate, notes, referenceNumber } = req.body;
    
    const bill = await Billing.findOne({
      _id: req.params.id,
      shop: req.user.shop,
      status: { $in: ['generated', 'draft'] }
    });
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }
    
    // Update payment
    bill.payment = {
      ...bill.payment,
      amount: parseFloat(amount),
      method,
      transactionId,
      paymentDate: paymentDate || new Date(),
      notes,
      referenceNumber
    };
    
    // Update payment status based on amount
    if (bill.payment.amount >= bill.finalAmount) {
      bill.payment.status = 'paid';
    } else if (bill.payment.amount > 0) {
      bill.payment.status = 'partial';
    } else {
      bill.payment.status = 'pending';
    }
    
    // If bill was draft and payment is made, mark as generated
    if (bill.status === 'draft' && (bill.payment.status === 'paid' || bill.payment.status === 'partial')) {
      bill.status = 'generated';
    }
    
    bill.updatedBy = req.user._id;
    
    await bill.save();
    
    // Create payment record
    await Payment.create({
      shop: req.user.shop,
      customer: bill.customer,
      invoice: bill._id,
      invoiceNumber: bill.invoiceNumber,
      amount: bill.payment.amount,
      method: bill.payment.method,
      transactionId: bill.payment.transactionId,
      referenceNumber: bill.payment.referenceNumber,
      date: bill.payment.paymentDate,
      status: 'completed',
      notes: bill.payment.notes,
      createdBy: req.user._id
    });
    
    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: bill
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get bill by invoice number
// @route   GET /api/billing/invoice/:invoiceNumber
// @access  Private
exports.getBillByInvoiceNumber = async (req, res) => {
  try {
    const bill = await Billing.findOne({
      invoiceNumber: req.params.invoiceNumber,
      shop: req.user.shop
    })
    .populate('customer')
    .populate('optometrist', 'name email')
    .populate('prescription')
    .populate('createdBy', 'name email');
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    console.error('Error fetching bill:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get customer billing history
// @route   GET /api/billing/customer/:customerId
// @access  Private
exports.getCustomerBills = async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Verify customer belongs to shop
    const customer = await Customer.findOne({
      _id: customerId,
      shop: req.user.shop
    });
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    const bills = await Billing.find({
      shop: req.user.shop,
      customer: customerId,
      status: { $in: ['generated', 'paid'] }
    })
    .populate('optometrist', 'name email')
    .sort({ invoiceDate: -1 })
    .lean();
    
    // Calculate customer billing summary
    const summary = bills.reduce((acc, bill) => {
      acc.totalBills += 1;
      acc.totalAmount += bill.finalAmount;
      acc.totalPaid += bill.payment.status === 'paid' ? bill.payment.amount : 0;
      acc.totalPending += bill.payment.status === 'pending' ? bill.finalAmount : 0;
      acc.totalPartial += bill.payment.status === 'partial' ? (bill.finalAmount - bill.payment.amount) : 0;
      return acc;
    }, {
      totalBills: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalPending: 0,
      totalPartial: 0
    });
    
    res.status(200).json({
      success: true,
      data: {
        customer,
        bills,
        summary
      }
    });
  } catch (error) {
    console.error('Error fetching customer bills:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get billing statistics
// @route   GET /api/billing/stats
// @access  Private
exports.getBillingStats = async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    
    let matchStage = { 
      shop: req.user.shop, 
      status: { $in: ['generated', 'paid'] } 
    };
    
    // Validate shop ID
    if (!mongoose.Types.ObjectId.isValid(req.user.shop)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop ID format'
      });
    }
    
    // Set date range based on period
    const now = new Date();
    let startOfRange, endOfRange;
    
    if (period === 'today') {
      startOfRange = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endOfRange = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (period === 'week') {
      startOfRange = new Date(now.setDate(now.getDate() - now.getDay()));
      endOfRange = new Date(now);
      endOfRange.setDate(endOfRange.getDate() + 7);
    } else if (period === 'month') {
      startOfRange = new Date(now.getFullYear(), now.getMonth(), 1);
      endOfRange = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (period === 'year') {
      startOfRange = new Date(now.getFullYear(), 0, 1);
      endOfRange = new Date(now.getFullYear(), 11, 31);
    }
    
    // Custom date range
    if (startDate || endDate) {
      matchStage.invoiceDate = {};
      if (startDate) {
        startOfRange = new Date(startDate);
        matchStage.invoiceDate.$gte = startOfRange;
      }
      if (endDate) {
        endOfRange = new Date(endDate);
        matchStage.invoiceDate.$lte = endOfRange;
      }
    } else if (startOfRange && endOfRange) {
      // Use period-based range
      matchStage.invoiceDate = {
        $gte: startOfRange,
        $lte: endOfRange
      };
    }
    
    // Convert shop ID to ObjectId
    const shopId = new mongoose.Types.ObjectId(req.user.shop);
    matchStage.shop = shopId;
    
    const stats = await Billing.aggregate([
      {
        $match: matchStage
      },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalDiscount: { $sum: { $add: ['$totalDiscount', '$additionalDiscount'] } },
          totalTax: { $sum: '$totalTax' },
          byPaymentMethod: {
            $push: {
              method: '$payment.method',
              amount: '$finalAmount'
            }
          },
          byStatus: {
            $push: {
              status: '$payment.status',
              amount: '$finalAmount'
            }
          },
          dailyRevenue: {
            $push: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$invoiceDate" } },
              amount: '$finalAmount'
            }
          }
        }
      },
      {
        $project: {
          totalBills: 1,
          totalRevenue: 1,
          totalDiscount: 1,
          totalTax: 1,
          averageBillValue: { $divide: ['$totalRevenue', { $cond: [{ $eq: ['$totalBills', 0] }, 1, '$totalBills'] }] },
          paymentMethodStats: {
            $arrayToObject: {
              $map: {
                input: '$byPaymentMethod',
                as: 'item',
                in: {
                  k: '$$item.method',
                  v: { $sum: ['$$item.amount'] }
                }
              }
            }
          },
          paymentStatusStats: {
            $arrayToObject: {
              $map: {
                input: '$byStatus',
                as: 'item',
                in: {
                  k: '$$item.status',
                  v: { $sum: ['$$item.amount'] }
                }
              }
            }
          },
          dailyRevenue: 1
        }
      }
    ]);
    
    // Get top customers
    const topCustomers = await Billing.aggregate([
      {
        $match: matchStage
      },
      {
        $group: {
          _id: '$customer',
          totalSpent: { $sum: '$finalAmount' },
          billCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalSpent: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      {
        $unwind: '$customer'
      },
      {
        $project: {
          customer: {
            name: '$customer.name',
            phone: '$customer.phone',
            customerId: '$customer.customerId'
          },
          totalSpent: 1,
          billCount: 1
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        summary: stats[0] || {
          totalBills: 0,
          totalRevenue: 0,
          totalDiscount: 0,
          totalTax: 0,
          averageBillValue: 0,
          paymentMethodStats: {},
          paymentStatusStats: {},
          dailyRevenue: []
        },
        topCustomers
      }
    });
  } catch (error) {
    console.error('Error fetching billing stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Export bills to CSV/Excel
// @route   GET /api/billing/export
// @access  Private
exports.exportBills = async (req, res) => {
  try {
    const { startDate, endDate, format = 'csv' } = req.query;
    
    const query = {
      shop: req.user.shop,
      status: { $in: ['generated', 'paid'] }
    };
    
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }
    
    const bills = await Billing.find(query)
      .populate('customer', 'name phone email customerId')
      .populate('optometrist', 'name')
      .sort({ invoiceDate: -1 })
      .lean();
    
    // Convert to CSV format
    if (format === 'csv') {
      const csvData = bills.map(bill => ({
        'Invoice Number': bill.invoiceNumber,
        'Date': bill.invoiceDate.toISOString().split('T')[0],
        'Customer': bill.customer?.name || 'N/A',
        'Customer Phone': bill.customer?.phone || 'N/A',
        'Optometrist': bill.optometrist?.name || 'N/A',
        'Subtotal': bill.subtotal,
        'Discount': bill.totalDiscount + bill.additionalDiscount,
        'Tax': bill.totalTax,
        'Final Amount': bill.finalAmount,
        'Payment Method': bill.payment.method,
        'Payment Status': bill.payment.status,
        'Status': bill.status,
        'Notes': bill.notes || ''
      }));
      
      res.status(200).json({
        success: true,
        data: csvData,
        format: 'csv'
      });
    } else {
      // Return JSON by default
      res.status(200).json({
        success: true,
        data: bills,
        format: 'json'
      });
    }
  } catch (error) {
    console.error('Error exporting bills:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};