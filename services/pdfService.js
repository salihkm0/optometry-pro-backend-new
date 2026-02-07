const ejs = require('ejs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const fsExtra = require('fs-extra');
const QRCode = require('qrcode');
const Shop = require('../models/Shop');
const Billing = require('../models/Billing');
const Customer = require('../models/Customer');

class PDFService {
    constructor() {
        this.templatesDir = path.join(__dirname, '../views');
        this.outputDir = path.join(__dirname, '../public/invoices');
        
        // Ensure output directory exists
        fsExtra.ensureDirSync(this.outputDir);
    }

    // Helper function to format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    }

    // Helper function to format date
    formatDate(date) {
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    // Generate invoice number in Indian format
    generateIndianInvoiceNumber(bill, shop) {
        const year = new Date(bill.invoiceDate).getFullYear();
        const month = (new Date(bill.invoiceDate).getMonth() + 1).toString().padStart(2, '0');
        const sequence = bill.invoiceNumber.split('-').pop() || '001';
        return `INV/${shop.name.substring(0, 3).toUpperCase()}/${year}-${month}/${sequence}`;
    }

    // Get company details from shop
    async getCompanyDetails(shopId) {
        const shop = await Shop.findById(shopId).lean();
        return {
            name: shop?.name || 'Eye Care Center',
            address: shop?.address || '123 Main Street, City, State - 560001',
            phone: shop?.phone || '+91 9876543210',
            email: shop?.email || 'info@eyecare.com',
            gstin: shop?.gstin || '29ABCDE1234F1Z5',
            pan: shop?.pan || 'ABCDE1234F',
            website: shop?.website || 'www.eyecare.com',
            bankName: shop?.bankName || 'State Bank of India',
            accountNumber: shop?.accountNumber || 'XXXXXXXX1234',
            ifscCode: shop?.ifscCode || 'SBIN0001234',
            upiId: shop?.upiId || 'eyecare@upi',
            logo: shop?.logo || null
        };
    }

    // Generate PDF using Puppeteer (Best quality)
    async generatePDFWithPuppeteer(html, options = {}) {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            
            // Set page content
            await page.setContent(html, {
                waitUntil: 'networkidle0'
            });
            
            // Set PDF options
            const pdfOptions = {
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '0.5in',
                    right: '0.5in',
                    bottom: '0.5in',
                    left: '0.5in'
                },
                displayHeaderFooter: false,
                ...options
            };
            
            // Generate PDF
            const pdfBuffer = await page.pdf(pdfOptions);
            
            return pdfBuffer;
        } finally {
            await browser.close();
        }
    }

    // Generate HTML from template
    async generateHTML(billId, user) {
        try {
            // Fetch bill with all related data
            const bill = await Billing.findById(billId)
                .populate('customer', 'name phone email address customerId')
                .populate('optometrist', 'name email')
                .populate('shop', 'name address phone email gstin pan website')
                .lean();

            if (!bill) {
                throw new Error('Bill not found');
            }

            // Get company details
            const company = await this.getCompanyDetails(bill.shop._id);
            
            // Format data for template
            const templateData = {
                bill: {
                    ...bill,
                    invoiceNumber: this.generateIndianInvoiceNumber(bill, bill.shop),
                    products: bill.products || [],
                    payment: {
                        method: bill.payment?.method || 'cash',
                        amount: bill.payment?.amount || 0,
                        status: bill.payment?.status || 'pending',
                        transactionId: bill.payment?.transactionId || ''
                    }
                },
                customer: bill.customer,
                company,
                generatedBy: user?.name || 'System',
                formatCurrency: this.formatCurrency,
                formatDate: this.formatDate
            };

            // Read and render template
            const templatePath = path.join(this.templatesDir, 'bill/layout.ejs');
            const template = await fs.readFile(templatePath, 'utf-8');
            
            const html = ejs.render(template, templateData);
            return html;
        } catch (error) {
            console.error('Error generating HTML:', error);
            throw error;
        }
    }

    // Generate and save PDF
    async generateInvoicePDF(billId, user, options = {}) {
        try {
            // Generate HTML
            const html = await this.generateHTML(billId, user);
            
            // Generate PDF
            const pdfBuffer = await this.generatePDFWithPuppeteer(html, options);
            
            // Generate filename
            const bill = await Billing.findById(billId).lean();
            const filename = `invoice_${bill.invoiceNumber}_${Date.now()}.pdf`;
            const filepath = path.join(this.outputDir, filename);
            
            // Save PDF to file
            await fs.writeFile(filepath, pdfBuffer);
            
            // Update bill with PDF path
            await Billing.findByIdAndUpdate(billId, {
                $set: {
                    'pdfUrl': `/invoices/${filename}`,
                    'lastPrinted': new Date(),
                    'printedBy': user._id
                }
            });
            
            return {
                buffer: pdfBuffer,
                filepath,
                filename,
                url: `/invoices/${filename}`
            };
        } catch (error) {
            console.error('Error generating PDF:', error);
            throw error;
        }
    }

    // Generate and return PDF buffer only (for immediate download)
    async generatePDFBuffer(billId, user) {
        const html = await this.generateHTML(billId, user);
        return await this.generatePDFWithPuppeteer(html);
    }

    // Generate simplified receipt
    async generateReceipt(billId, user) {
        try {
            const bill = await Billing.findById(billId)
                .populate('customer', 'name phone')
                .lean();

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .receipt-title { font-size: 24px; font-weight: bold; color: #333; }
                        .receipt-info { margin: 10px 0; }
                        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        .total { font-weight: bold; font-size: 18px; margin-top: 20px; }
                        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="receipt-title">PAYMENT RECEIPT</div>
                        <div>Invoice: ${bill.invoiceNumber}</div>
                    </div>
                    
                    <div class="receipt-info">
                        <div>Date: ${this.formatDate(new Date())}</div>
                        <div>Customer: ${bill.customer.name}</div>
                        <div>Phone: ${bill.customer.phone}</div>
                    </div>
                    
                    <table class="items-table">
                        <tr>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Amount</th>
                        </tr>
                        ${bill.products.map((item, index) => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity}</td>
                                <td>${this.formatCurrency(item.total)}</td>
                            </tr>
                        `).join('')}
                    </table>
                    
                    <div class="total">
                        Total: ${this.formatCurrency(bill.finalAmount)}
                    </div>
                    
                    <div class="footer">
                        Thank you for your business!<br>
                        Generated on: ${new Date().toLocaleString()}
                    </div>
                </body>
                </html>
            `;

            return await this.generatePDFWithPuppeteer(html, {
                format: 'A5',
                margin: { top: '0.2in', right: '0.2in', bottom: '0.2in', left: '0.2in' }
            });
        } catch (error) {
            console.error('Error generating receipt:', error);
            throw error;
        }
    }

    // Generate bulk invoices (for multiple bills)
    async generateBulkInvoices(billIds, user) {
        const results = [];
        
        for (const billId of billIds) {
            try {
                const result = await this.generateInvoicePDF(billId, user);
                results.push({
                    billId,
                    success: true,
                    filename: result.filename,
                    url: result.url
                });
            } catch (error) {
                results.push({
                    billId,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    // Preview HTML in browser (for testing)
    async previewHTML(billId, user) {
        const html = await this.generateHTML(billId, user);
        return html;
    }
}

module.exports = new PDFService();