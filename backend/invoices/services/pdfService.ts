// PDF generation service for invoices

import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { logger } from '../../utils/logger';
import * as invoiceItemQueries from '../queries/invoice-item-queries';

/**
 * Generate PDF invoice
 */
export async function generateInvoicePDF(
  client: any,
  invoiceId: number,
  merchantId: number,
  res: Response
): Promise<void> {
  try {
    // Get invoice with all details
    const invoiceQuery = invoiceItemQueries.getInvoiceForPdfQuery(invoiceId, merchantId);
    const invoiceResult = await client.query(invoiceQuery.query, invoiceQuery.queryParams);
    
    if (invoiceResult.rows.length === 0) {
      res.status(404).json({ message: 'Invoice not found' });
      return;
    }
    
    const invoice = invoiceResult.rows[0];
    
    // Get invoice items with GST details
    const itemsQuery = invoiceItemQueries.getInvoiceItemsQuery(invoiceId);
    const itemsResult = await client.query(itemsQuery.query, itemsQuery.queryParams);
    const items = itemsResult.rows;
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Set response headers
    const invoiceNumber = `${invoice.invoice_prefix || 'INV-'}${String(invoice.invoice_number).padStart(5, '0')}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    const pageWidth = doc.page.width;
    const margin = 50;
    let y = 60;
    
    // Header: TAX INVOICE (centered, bold)
    doc.fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', 0, y, { align: 'center', width: pageWidth });
    y += 40;
    
    // Top right section: Date, Invoice No, Ref No
    const rightInfoX = pageWidth - 250;
    doc.fontSize(9).font('Helvetica');
    doc.text('Date:', rightInfoX, y);
    doc.text(new Date(invoice.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }), rightInfoX + 70, y);
    y += 15;
    doc.text('Invoice No.', rightInfoX, y);
    doc.text(invoiceNumber, rightInfoX + 70, y);
    y += 15;
    doc.text('Ref No.', rightInfoX, y);
    doc.text(`ORD${invoice.order_id}`, rightInfoX + 70, y);
    
    // Reset y for customer/merchant section
    y = 140;
    
    // Two column layout: To (left) and From (right)
    const leftColX = margin;
    const midPoint = pageWidth / 2;
    
    // Left: To (Customer)
    doc.fontSize(9).font('Helvetica-Bold').text('To,', leftColX, y);
    let leftY = y + 15;
    doc.font('Helvetica').fontSize(9);
    doc.text(invoice.customer_name || 'N/A', leftColX, leftY);
    leftY += 12;
    if (invoice.customer_phone) {
      doc.text(invoice.customer_phone, leftColX, leftY);
      leftY += 12;
    }
    if (invoice.customer_email) {
      doc.text(invoice.customer_email, leftColX, leftY);
      leftY += 12;
    }
    
    // Right: From (Seller)
    doc.fontSize(9).font('Helvetica-Bold').text('From (Seller):', midPoint, y);
    let rightY = y + 15;
    doc.font('Helvetica').fontSize(9);
    if (invoice.billing_address_line1) {
      const address = [
        invoice.billing_address_line1,
        invoice.billing_address_line2,
        invoice.billing_city,
        invoice.billing_state,
        invoice.billing_pincode
      ].filter(Boolean).join(', ');
      doc.text(address, midPoint, rightY, { width: pageWidth - midPoint - margin });
      rightY += 25;
    }
    if (invoice.gst_number) {
      doc.text('GST No.', midPoint, rightY);
      doc.text(invoice.gst_number, midPoint + 70, rightY);
      rightY += 12;
    }
    if (invoice.pan_number) {
      doc.text('PAN No.', midPoint, rightY);
      doc.text(invoice.pan_number, midPoint + 70, rightY);
      rightY += 12;
    }
    
    y = Math.max(leftY, rightY) + 25;
    
    // Items table with borders
    const tableTop = y;
    const tableWidth = pageWidth - 2 * margin;
    const slW = 30;
    const descW = 220;
    const hsnW = 70;
    const qtyW = 40;
    const rateW = 65;
    const amountW = 70;
    
    // Draw vertical lines for columns
    const drawVerticalLines = (yStart: number, height: number) => {
      doc.moveTo(margin, yStart).lineTo(margin, yStart + height).stroke();
      doc.moveTo(margin + slW, yStart).lineTo(margin + slW, yStart + height).stroke();
      doc.moveTo(margin + slW + descW, yStart).lineTo(margin + slW + descW, yStart + height).stroke();
      doc.moveTo(margin + slW + descW + hsnW, yStart).lineTo(margin + slW + descW + hsnW, yStart + height).stroke();
      doc.moveTo(margin + slW + descW + hsnW + qtyW, yStart).lineTo(margin + slW + descW + hsnW + qtyW, yStart + height).stroke();
      doc.moveTo(margin + slW + descW + hsnW + qtyW + rateW, yStart).lineTo(margin + slW + descW + hsnW + qtyW + rateW, yStart + height).stroke();
      doc.moveTo(margin + tableWidth, yStart).lineTo(margin + tableWidth, yStart + height).stroke();
    };
    
    // Table header with border
    doc.rect(margin, tableTop, tableWidth, 25).stroke();
    drawVerticalLines(tableTop, 25);
    
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('SL', margin + 2, tableTop + 8, { width: slW - 4, align: 'center' });
    doc.text('Particulars/ Description', margin + slW + 2, tableTop + 8, { width: descW - 4 });
    doc.text('HSN/SAC No', margin + slW + descW + 2, tableTop + 8, { width: hsnW - 4, align: 'center' });
    doc.text('Qty', margin + slW + descW + hsnW + 2, tableTop + 8, { width: qtyW - 4, align: 'center' });
    doc.text('Rate (Rs.)', margin + slW + descW + hsnW + qtyW + 2, tableTop + 8, { width: rateW - 4, align: 'right' });
    doc.text('Amount (Rs.)', margin + slW + descW + hsnW + qtyW + rateW + 2, tableTop + 8, { width: amountW - 4, align: 'right' });
    
    y = tableTop + 25;
    
    // Table rows with borders
    doc.font('Helvetica').fontSize(8);
    items.forEach((item: any, index: number) => {
      const rowHeight = 30;
      doc.rect(margin, y, tableWidth, rowHeight).stroke();
      drawVerticalLines(y, rowHeight);
      
      doc.text((index + 1).toString(), margin + 2, y + 10, { width: slW - 4, align: 'center' });
      doc.text(item.product_name || 'Product', margin + slW + 2, y + 10, { width: descW - 4 });
      doc.text(item.hsn_code || '-', margin + slW + descW + 2, y + 10, { width: hsnW - 4, align: 'center' });
      doc.text(item.quantity.toString(), margin + slW + descW + hsnW + 2, y + 10, { width: qtyW - 4, align: 'center' });
      doc.text(parseFloat(item.unit_price).toFixed(2), margin + slW + descW + hsnW + qtyW + 2, y + 10, { width: rateW - 4, align: 'right' });
      doc.text(parseFloat(item.total_amount).toFixed(2), margin + slW + descW + hsnW + qtyW + rateW + 2, y + 10, { width: amountW - 4, align: 'right' });
      
      y += rowHeight;
    });
    
    // GST breakdown section
    y += 15;
    doc.fontSize(9).font('Helvetica');
    const gstX = pageWidth - 200;
    
    if (invoice.cgst_amount > 0) {
      doc.text('CGST', margin + 20, y);
      doc.text(parseFloat(invoice.cgst_amount).toFixed(2), gstX, y);
      y += 15;
      doc.text('SGST', margin + 20, y);
      doc.text(parseFloat(invoice.sgst_amount || 0).toFixed(2), gstX, y);
      y += 15;
    }
    if (invoice.igst_amount > 0) {
      doc.text('IGST', margin + 20, y);
      doc.text(parseFloat(invoice.igst_amount).toFixed(2), gstX, y);
      y += 15;
    }
    
    // Discount (if applicable)
    if (invoice.discount_amount && parseFloat(invoice.discount_amount) > 0) {
      doc.text('Discount', margin + 20, y);
      doc.text(`-${parseFloat(invoice.discount_amount).toFixed(2)}`, gstX, y);
      y += 15;
    }
    
    // Grand Total
    y += 10;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Grand Total', margin + 20, y);
    doc.text(parseFloat(invoice.total_amount).toFixed(2), gstX, y);
    
    // Bank details section
    if (invoice.bank_name || invoice.bank_account_number || invoice.ifsc_code) {
      y += 40;
      doc.fontSize(10).font('Helvetica-Bold').text('BANK DETAILS:', margin, y);
      y += 18;
      doc.font('Helvetica').fontSize(9);
      
      if (invoice.bank_name) {
        doc.text('Bank Name:', margin, y);
        doc.text(invoice.bank_name, margin + 80, y);
        y += 15;
      }
      if (invoice.bank_account_number) {
        doc.text('A/C:', margin, y);
        doc.text(invoice.bank_account_number, margin + 80, y);
        y += 15;
      }
      if (invoice.ifsc_code) {
        doc.text('IFSC:', margin, y);
        doc.text(invoice.ifsc_code, margin + 80, y);
      }
    }
    
    // Finalize PDF
    doc.end();
    
    logger.info('Invoice PDF generated', { invoiceId, invoiceNumber });
  } catch (error) {
    logger.error('Error generating invoice PDF', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

