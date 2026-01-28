const { body } = require('express-validator');

const createRecordValidation = [
  body('customer')
    .notEmpty()
    .withMessage('Customer is required')
    .isMongoId()
    .withMessage('Invalid customer ID'),
  
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Please enter a valid date'),
  
  body('examinationType')
    .optional()
    .isIn(['routine', 'comprehensive', 'contact_lens', 'follow_up', 'emergency', 'other'])
    .withMessage('Invalid examination type'),
  
  body('right_eye.dv.sph')
    .optional()
    .matches(/^[+-]?\d+(\.\d{1,2})?$/)
    .withMessage('Invalid SPH value'),
  
  body('right_eye.dv.cyl')
    .optional()
    .matches(/^[+-]?\d+(\.\d{1,2})?$/)
    .withMessage('Invalid CYL value'),
  
  body('right_eye.dv.axis')
    .optional()
    .matches(/^\d{1,3}$/)
    .withMessage('Axis must be between 0 and 180'),
  
  body('right_eye.dv.va')
    .optional()
    .matches(/^\d{1,2}(\/\d{1,2})?$/)
    .withMessage('Invalid VA format (use format like 20/20)'),
  
  body('left_eye.dv.sph')
    .optional()
    .matches(/^[+-]?\d+(\.\d{1,2})?$/)
    .withMessage('Invalid SPH value'),
  
  body('left_eye.dv.cyl')
    .optional()
    .matches(/^[+-]?\d+(\.\d{1,2})?$/)
    .withMessage('Invalid CYL value'),
  
  body('optometrist')
    .optional()
    .isMongoId()
    .withMessage('Invalid optometrist ID'),
  
  body('assistant')
    .optional()
    .isMongoId()
    .withMessage('Invalid assistant ID'),
  
  body('prescriptionType')
    .optional()
    .isIn(['distance', 'reading', 'bifocal', 'progressive', 'computer', 'sunglasses', 'contact_lens', 'other'])
    .withMessage('Invalid prescription type'),
  
  body('billing.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  
  body('billing.paid')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Paid amount must be a positive number'),
  
  body('billing.discount')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount must be between 0 and 100'),
  
  body('billing.paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'insurance', 'online', 'other'])
    .withMessage('Invalid payment method'),
  
  body('status')
    .optional()
    .isIn(['draft', 'completed', 'cancelled', 'archived'])
    .withMessage('Invalid status'),
  
  body('nextAppointment')
    .optional()
    .isISO8601()
    .withMessage('Please enter a valid date')
];

const updateRecordValidation = [
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Please enter a valid date'),
  
  body('status')
    .optional()
    .isIn(['draft', 'completed', 'cancelled', 'archived'])
    .withMessage('Invalid status'),
  
  body('billing.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  
  body('billing.paid')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Paid amount must be a positive number')
];

module.exports = {
  createRecordValidation,
  updateRecordValidation
};