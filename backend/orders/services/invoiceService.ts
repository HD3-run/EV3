// Invoice service - Business logic for invoice creation

import { PoolClient } from 'pg';
import * as orderQueries from '../queries/order-queries';
import * as invoiceQueries from '../queries/invoice-queries';

/**
 * Auto-create invoice from paid order
 * Handles GST calculation (CGST/SGST for intra-state, IGST for inter-state)
 */
export async function createInvoiceFromPaidOrder(
  client: PoolClient,
  orderId: number,
  merchantId: number,
  totalAmount: number
) {
  try {
    console.log('🔄 Creating invoice for paid order:', { orderId, merchantId, totalAmount });
    
    // Get order details with customer state
    const orderQuery = orderQueries.getOrderDetailsWithCustomerState(orderId, merchantId);
    const orderResult = await client.query(orderQuery.query, orderQuery.queryParams);
    
    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }
    
    const order = orderResult.rows[0];
    
    // Get merchant billing details with state code
    const billingQuery = invoiceQueries.getMerchantBillingDetails(merchantId);
    const billingResult = await client.query(billingQuery.query, billingQuery.queryParams);
    
    if (billingResult.rows.length === 0) {
      throw new Error('Merchant billing details not found. Please set up billing details first.');
    }
    
    const { billing_id, next_invoice_number, invoice_prefix, state_code: merchantStateCode } = billingResult.rows[0];
    const customerStateCode = order.customer_state_code;
    
    console.log('📋 GST Calculation - Merchant State:', merchantStateCode, 'Customer State:', customerStateCode);
    
    // Update next_invoice_number atomically
    const invoiceNumberQuery = invoiceQueries.updateNextInvoiceNumber(merchantId);
    const invoiceNumberResult = await client.query(invoiceNumberQuery.query, invoiceNumberQuery.queryParams);
    
    const invoiceNumber = invoiceNumberResult.rows[0].next_invoice_number;
    const invoicePrefix = invoice_prefix || 'INV-';
    
    // Calculate due date (30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    
    // Get order items with product GST details
    const orderItemsQuery = invoiceQueries.getOrderItemsWithGst(orderId);
    const orderItemsResult = await client.query(orderItemsQuery.query, orderItemsQuery.queryParams);
    
    // Calculate GST for each item
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let subtotal = 0;
    
    const itemsWithGst = orderItemsResult.rows.map((item: any) => {
      const itemTotal = parseFloat(item.total_price);
      const gstRate = parseFloat(item.gst_rate) || 18.00;
      const gstAmount = (itemTotal * gstRate) / 100;
      
      subtotal += itemTotal;
      
      const isIntraState = merchantStateCode && customerStateCode && merchantStateCode === customerStateCode;
      
      let cgst = 0, sgst = 0, igst = 0;
      
      if (isIntraState) {
        cgst = gstAmount / 2;
        sgst = gstAmount / 2;
        totalCgst += cgst;
        totalSgst += sgst;
      } else {
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
    const finalTotalAmount = subtotal + totalGst;
    
    console.log('💰 GST Breakdown - CGST:', totalCgst.toFixed(2), 'SGST:', totalSgst.toFixed(2), 'IGST:', totalIgst.toFixed(2), 'Total:', finalTotalAmount.toFixed(2));
    
    // Create invoice header with GST breakdown
    const invoiceHeaderQuery = invoiceQueries.createInvoiceHeader(
      invoiceNumber,
      orderId,
      merchantId,
      billing_id,
      dueDate,
      subtotal,
      totalGst,
      totalCgst,
      totalSgst,
      totalIgst,
      finalTotalAmount
    );
    const invoiceResult = await client.query(invoiceHeaderQuery.query, invoiceHeaderQuery.queryParams);
    
    const invoice = invoiceResult.rows[0];
    
    // Insert invoice items with GST breakdown
    for (const item of itemsWithGst) {
      const invoiceItemQuery = invoiceQueries.insertInvoiceItem(
        invoice.invoice_id,
        item.order_item_id,
        item.product_id,
        item.inventory_id,
        item.quantity,
        item.price_per_unit,
        item.total_price,
        item.hsn_code,
        item.gst_rate,
        item.cgst_amount,
        item.sgst_amount,
        item.igst_amount
      );
      await client.query(invoiceItemQuery.query, invoiceItemQuery.queryParams);
    }
    
    console.log('✅ Invoice created successfully:', {
      invoiceId: invoice.invoice_id,
      invoiceNumber: invoiceNumber,
      displayNumber: `${invoicePrefix}${invoiceNumber}`,
      orderId: orderId,
      totalAmount: finalTotalAmount
    });
    
    return {
      invoiceId: invoice.invoice_id,
      invoiceNumber: invoiceNumber,
      displayNumber: `${invoicePrefix}${invoiceNumber}`,
      totalAmount: finalTotalAmount
    };
    
  } catch (error) {
    console.log('❌ Error creating invoice for paid order:', error);
    throw error;
  }
}

