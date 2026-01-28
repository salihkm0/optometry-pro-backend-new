// controllers/printController.js
const asyncHandler = require('express-async-handler'); 
const OptometryRecord = require('../models/OptometryRecord.js');

/**
 * Get record for printing - NO AUTHENTICATION
 */
const getRecordForPrint = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { autoprint, pdf, autoclose } = req.query;
  
  const record = await OptometryRecord.findById(id)
    .populate('customer', 'name age sex phone email customerId dateOfBirth medicalHistory')
    .populate('shop', 'name contact logo settings')
    .populate('optometrist', 'name')
    .populate('assistant', 'name')
    .populate('createdBy', 'name')
    .lean();
  
  if (!record) {
    return res.status(404).render('error', { 
      title: 'Record Not Found',
      message: 'The requested record could not be found.' 
    });
  }
  
  // Format dates
  record.formattedDate = formatDate(record.date);
  if (record.nextAppointment) {
    record.formattedNextAppointment = formatDate(record.nextAppointment);
  }
  if (record.customer.dateOfBirth) {
    record.customer.formattedDateOfBirth = formatDate(record.customer.dateOfBirth);
  }
  
  // Calculate age if not present
  if (!record.customer.age && record.customer.dateOfBirth) {
    const birthDate = new Date(record.customer.dateOfBirth);
    const ageDiff = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiff);
    record.customer.age = Math.abs(ageDate.getUTCFullYear() - 1970);
  }
  
  // Set view variables
  const viewData = {
    title: `Record ${record.recordId} - Print View`,
    record,
    autoprint: autoprint === 'true',
    autoclose: autoclose === 'true',
    isPDF: pdf === 'true'
  };
  
  // Render the print template
  res.render('print/record', viewData);
});

/**
 * Get multiple records for printing - NO AUTHENTICATION
 */
const getMultipleRecordsForPrint = asyncHandler(async (req, res) => {
  const { ids } = req.query;
  const { startDate, endDate, shopId } = req.query;
  
  if (!ids && (!startDate || !endDate)) {
    return res.status(400).render('error', {
      title: 'Bad Request',
      message: 'Please provide either record IDs or date range.'
    });
  }
  
  let query = {};
  
  if (shopId) {
    query.shop = shopId;
  }
  
  if (ids) {
    const idArray = ids.split(',').map(id => id.trim());
    query._id = { $in: idArray };
  } else if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const records = await OptometryRecord.find(query)
    .populate('customer', 'name age sex phone email customerId')
    .populate('shop', 'name contact')
    .populate('optometrist', 'name')
    .sort({ date: 1 })
    .lean();
  
  if (records.length === 0) {
    return res.status(404).render('error', {
      title: 'No Records Found',
      message: 'No records found for the specified criteria.'
    });
  }
  
  // Format dates for all records
  records.forEach(record => {
    record.formattedDate = formatDate(record.date);
    if (record.nextAppointment) {
      record.formattedNextAppointment = formatDate(record.nextAppointment);
    }
  });
  
  res.render('print/records-batch', {
    title: 'Records Batch Print',
    records,
    printDate: formatDate(new Date())
  });
});

/**
 * Get prescription card for printing - NO AUTHENTICATION
 */
const getPrescriptionCard = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { autoprint } = req.query;
  
  const record = await OptometryRecord.findById(id)
    .populate('customer', 'name age sex phone customerId')
    .populate('shop', 'name contact logo')
    .populate('optometrist', 'name')
    .lean();
  
  if (!record) {
    return res.status(404).render('error', {
      title: 'Record Not Found',
      message: 'The requested record could not be found.'
    });
  }
  
  // Format date
  record.formattedDate = formatDate(record.date);
  
  // Get prescription expiration date (2 years from exam date)
  const expirationDate = new Date(record.date);
  expirationDate.setFullYear(expirationDate.getFullYear() + 2);
  record.expirationDate = formatDate(expirationDate);
  
  const viewData = {
    title: `Prescription - ${record.customer.name}`,
    record,
    autoprint: autoprint === 'true'
  };
  
  res.render('print/prescription-card', viewData);
});

/**
 * Get invoice for printing - NO AUTHENTICATION
 */
const getInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { autoprint } = req.query;
  
  const record = await OptometryRecord.findById(id)
    .populate('customer', 'name phone email address')
    .populate('shop', 'name contact address logo settings')
    .populate('createdBy', 'name')
    .lean();
  
  if (!record) {
    return res.status(404).render('error', {
      title: 'Record Not Found',
      message: 'The requested record could not be found.'
    });
  }
  
  // Format dates
  record.formattedDate = formatDate(record.date);
  
  // Calculate totals - fix potential null/undefined values
  const amount = record.billing?.amount || 0;
  const discountPercent = record.billing?.discount || 0;
  const paid = record.billing?.paid || 0;
  const discountAmount = amount * (discountPercent / 100);
  const subtotal = amount - discountAmount;
  const taxRate = record.shop?.settings?.taxRate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const balance = total - paid;
  
  // Invoice number
  const invoiceNumber = record.billing?.invoiceId || `INV-${record.recordId}`;
  
  const viewData = {
    title: `Invoice ${invoiceNumber}`,
    record,
    invoiceNumber,
    discountAmount,
    subtotal,
    taxRate,
    taxAmount,
    total,
    balance,
    autoprint: autoprint === 'true'
  };
  
  res.render('print/invoice', viewData);
});

/**
 * Export to PDF - NO AUTHENTICATION
 */
const exportToPDF = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const record = await OptometryRecord.findById(id)
    .populate('customer', 'name age sex phone email customerId')
    .populate('shop', 'name contact logo')
    .lean();
  
  if (!record) {
    return res.status(404).json({
      success: false,
      message: 'Record not found'
    });
  }
  
  // For PDF, redirect to the print page
  // In production, you would generate actual PDF here
  res.json({
    success: true,
    message: 'PDF generation not implemented. Use print view instead.',
    printUrl: `/print/records/${id}?pdf=true`
  });
});

/**
 * Helper function to format dates
 */
function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

module.exports = {
  getRecordForPrint,
  getMultipleRecordsForPrint,
  getPrescriptionCard,
  getInvoice,
  exportToPDF
};