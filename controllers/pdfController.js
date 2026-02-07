const PDFService = require('../services/pdfService');
const Billing = require('../models/Billing');
const fs = require('fs').promises;
const path = require('path');

// @desc    Generate and download invoice PDF
// @route   GET /api/billing/:id/print
// @access  Private
exports.printInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const { type = 'invoice', download = 'true' } = req.query;

        // Verify bill exists and belongs to shop
        const bill = await Billing.findOne({
            _id: id,
            shop: req.user.shop
        });

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        let pdfBuffer;
        
        if (type === 'receipt') {
            pdfBuffer = await PDFService.generateReceipt(id, req.user);
        } else {
            pdfBuffer = await PDFService.generatePDFBuffer(id, req.user);
        }

        // Set headers for PDF download
        const filename = type === 'receipt' 
            ? `receipt_${bill.invoiceNumber}.pdf`
            : `invoice_${bill.invoiceNumber}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        
        if (download === 'true') {
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        } else {
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        }

        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating PDF',
            error: error.message
        });
    }
};

// @desc    Generate and save invoice PDF
// @route   POST /api/billing/:id/generate-pdf
// @access  Private
exports.generateAndSavePDF = async (req, res) => {
    try {
        const { id } = req.params;

        const bill = await Billing.findOne({
            _id: id,
            shop: req.user.shop
        });

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        const result = await PDFService.generateInvoicePDF(id, req.user);

        res.status(200).json({
            success: true,
            message: 'PDF generated successfully',
            data: {
                url: result.url,
                filename: result.filename,
                downloadUrl: `/api/billing/${id}/download-pdf`
            }
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating PDF',
            error: error.message
        });
    }
};

// @desc    Download saved PDF
// @route   GET /api/billing/:id/download-pdf
// @access  Private
exports.downloadPDF = async (req, res) => {
    try {
        const { id } = req.params;

        const bill = await Billing.findOne({
            _id: id,
            shop: req.user.shop
        }).select('pdfUrl invoiceNumber');

        if (!bill || !bill.pdfUrl) {
            return res.status(404).json({
                success: false,
                message: 'PDF not found. Please generate it first.'
            });
        }

        const filepath = path.join(__dirname, '../public', bill.pdfUrl);
        
        // Check if file exists
        try {
            await fs.access(filepath);
        } catch {
            return res.status(404).json({
                success: false,
                message: 'PDF file not found on server'
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice_${bill.invoiceNumber}.pdf"`);
        
        const fileStream = require('fs').createReadStream(filepath);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Error downloading PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Error downloading PDF',
            error: error.message
        });
    }
};

// @desc    Preview invoice HTML
// @route   GET /api/billing/:id/preview
// @access  Private
exports.previewInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        const bill = await Billing.findOne({
            _id: id,
            shop: req.user.shop
        });

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        const html = await PDFService.previewHTML(id, req.user);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('Error previewing invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Error previewing invoice',
            error: error.message
        });
    }
};

// @desc    Bulk generate PDFs
// @route   POST /api/billing/bulk-generate-pdf
// @access  Private
exports.bulkGeneratePDF = async (req, res) => {
    try {
        const { billIds } = req.body;

        if (!Array.isArray(billIds) || billIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of bill IDs'
            });
        }

        // Limit bulk generation to 20 bills at a time
        if (billIds.length > 20) {
            return res.status(400).json({
                success: false,
                message: 'Cannot generate more than 20 PDFs at once'
            });
        }

        const results = await PDFService.generateBulkInvoices(billIds, req.user);

        res.status(200).json({
            success: true,
            message: 'Bulk PDF generation completed',
            data: {
                total: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results
            }
        });
    } catch (error) {
        console.error('Error in bulk PDF generation:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating bulk PDFs',
            error: error.message
        });
    }
};

// @desc    Get print options/config
// @route   GET /api/billing/print-options
// @access  Private
exports.getPrintOptions = async (req, res) => {
    try {
        const options = {
            paperSizes: [
                { value: 'A4', label: 'A4 (Standard)', default: true },
                { value: 'A5', label: 'A5 (Half)', default: false },
                { value: 'LETTER', label: 'Letter (US)', default: false },
                { value: 'LEGAL', label: 'Legal', default: false }
            ],
            printTypes: [
                { value: 'invoice', label: 'Full Invoice', default: true },
                { value: 'receipt', label: 'Payment Receipt', default: false },
                { value: 'simplified', label: 'Simplified Bill', default: false },
                { value: 'duplicate', label: 'Duplicate Copy', default: false }
            ],
            languages: [
                { value: 'en', label: 'English', default: true },
                { value: 'hi', label: 'Hindi', default: false },
                { value: 'ta', label: 'Tamil', default: false },
                { value: 'te', label: 'Telugu', default: false }
            ],
            features: {
                watermark: true,
                qrCode: true,
                termsAndConditions: true,
                signature: false,
                headerLogo: true,
                footerNotes: true
            }
        };

        res.status(200).json({
            success: true,
            data: options
        });
    } catch (error) {
        console.error('Error getting print options:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting print options',
            error: error.message
        });
    }
};