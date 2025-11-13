// Invoice service - Business logic for invoice creation

import { PoolClient } from 'pg';
import * as orderQueries from '../queries/order-queries';
import * as invoiceNumberQueries from '../queries/invoice-number-queries';

export interface CreateInvoiceResult {
  invoice: any;
  invoicePrefix: string;
  displayNumber: string;
}

/**
 * Create invoice from order with GST calculation
 */
export async function createInvoiceFromOrder(
  client: PoolClient,
  orderId: number,
  merchantId: number,
  dueDate: string,
  notes?: string,
  discountAmount: number = 0
): Promise<CreateInvoiceResult> {
  try {
    // Get order details with customer state
    const orderQuery = orderQueries.getOrderDetailsQuery(orderId, merchantId);
    const orderResult = await client.query(orderQuery.query, orderQuery.queryParams);
    
    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }
    
    const order = orderResult.rows[0];
    
    // Generate invoice number atomically
    const invoiceNumberQuery = invoiceNumberQueries.generateInvoiceNumberQuery(merchantId);
    const invoiceNumberResult = await client.query(invoiceNumberQuery.query, invoiceNumberQuery.queryParams);
    
    if (invoiceNumberResult.rows.length === 0) {
      throw new Error('Merchant billing details not found. Please set up billing details first.');
    }
    
    const invoiceNumber = invoiceNumberResult.rows[0].next_invoice_number;
    const invoicePrefix = invoiceNumberResult.rows[0].invoice_prefix || 'INV-';
    
    // Get billing_id and merchant state from merchant billing details
    const billingQuery = invoiceNumberQueries.getMerchantBillingDetailsQuery(merchantId);
    const billingResult = await client.query(billingQuery.query, billingQuery.queryParams);
    
    if (billingResult.rows.length === 0) {
      throw new Error('Merchant billing details not found. Please set up billing details first.');
    }
    
    const billingId = billingResult.rows[0].billing_id;
    const merchantStateCode = billingResult.rows[0].state_code;
    const customerStateCode = order.customer_state_code;
    
    console.log('📋 GST Calculation Debug:', {
      merchantStateCode,
      customerStateCode,
      merchantStateCodeType: typeof merchantStateCode,
      customerStateCodeType: typeof customerStateCode,
      merchantStateCodeTrimmed: merchantStateCode?.toString().trim(),
      customerStateCodeTrimmed: customerStateCode?.toString().trim(),
      areEqual: merchantStateCode === customerStateCode,
      areEqualTrimmed: merchantStateCode?.toString().trim() === customerStateCode?.toString().trim()
    });
    
    // Get order items with product GST details
    const orderItemsQuery = orderQueries.getOrderItemsWithGstQuery(orderId);
    const orderItemsResult = await client.query(orderItemsQuery.query, orderItemsQuery.queryParams);
    
    // Calculate GST for each item
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let subtotal = 0;
    
    const itemsWithGst = orderItemsResult.rows.map((item: any) => {
      const itemTotal = parseFloat(item.total_price);
      const gstRate = parseFloat(item.gst_rate) || 18.00;
      
      // Calculate GST amount (order's total_price is base amount, GST is added on top)
      const gstAmount = (itemTotal * gstRate) / 100;
      
      subtotal += itemTotal;
      
      // Determine if intra-state or inter-state (trim and compare as strings)
      const merchantState = merchantStateCode?.toString().trim();
      const customerState = customerStateCode?.toString().trim();
      const isIntraState = merchantState && customerState && merchantState === customerState;
      
      console.log('🔍 Item GST Check:', {
        merchantState,
        customerState,
        isIntraState,
        gstRate,
        gstAmount
      });
      
      let cgst = 0, sgst = 0, igst = 0;
      
      if (isIntraState) {
        // Intra-state: Split GST into CGST and SGST
        cgst = gstAmount / 2;
        sgst = gstAmount / 2;
        totalCgst += cgst;
        totalSgst += sgst;
      } else {
        // Inter-state: Use IGST
        igst = gstAmount;
        totalIgst += igst;
      }
      
      return {
        ...item,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        gst_rate: gstRate
      };
    });
    
    const totalGst = totalCgst + totalSgst + totalIgst;
    const totalAmount = subtotal + totalGst - discountAmount;
    
    console.log('💰 GST Breakdown - CGST:', totalCgst.toFixed(2), 'SGST:', totalSgst.toFixed(2), 'IGST:', totalIgst.toFixed(2), 'Total:', totalAmount.toFixed(2));
    
    // Create invoice header with GST breakdown
    const invoiceResult = await client.query(
      `INSERT INTO oms.invoices 
       (invoice_number, order_id, merchant_id, billing_id, invoice_date, due_date, 
        subtotal, tax_amount, discount_amount, total_amount, cgst_amount, sgst_amount, igst_amount, payment_status, notes)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8, $9, $10, $11, $12, 'unpaid', $13)
       RETURNING *`,
      [invoiceNumber, orderId, merchantId, billingId, dueDate, 
       subtotal, totalGst, discountAmount, totalAmount, totalCgst, totalSgst, totalIgst, notes]
    );
    
    const invoice = invoiceResult.rows[0];
    
    // Insert invoice items with GST breakdown
    for (const item of itemsWithGst) {
      await client.query(
        `INSERT INTO oms.invoice_items 
         (invoice_id, order_item_id, product_id, inventory_id, quantity, unit_price, total_amount, 
          hsn_code, gst_rate, cgst_amount, sgst_amount, igst_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [invoice.invoice_id, item.order_item_id, item.product_id, item.inventory_id, 
         item.quantity, item.price_per_unit, item.total_price, 
         item.hsn_code, item.gst_rate, item.cgst_amount, item.sgst_amount, item.igst_amount]
      );
    }
    
    return {
      invoice,
      invoicePrefix,
      displayNumber: `${invoicePrefix}${invoiceNumber}`
    };
  } catch (error) {
    throw error;
  }
}

