// Payment update service - Business logic for payment status updates

import { PoolClient } from 'pg';
import { logger } from '../../utils/logger';
import { PAYMENT_METHODS } from '../../utils/constants';
import { createInvoiceFromPaidOrder } from './invoiceService';
import { updateOrderPrices } from './orderService';
import { updateInvoiceStatus } from '../../invoices/services/invoiceUpdateService';

export interface PaymentUpdateRequest {
  status: string;
  paymentMethod?: string;
  amount?: number;
  pricePerUnit?: number;
}

/**
 * Update payment status with validation and invoice creation
 */
export async function updatePaymentStatus(
  client: PoolClient,
  orderId: number,
  merchantId: number,
  userId: number,
  paymentData: PaymentUpdateRequest
) {
  // Variables to track invoice creation status
  let invoiceCreationFailed = false;
  let invoiceCreationError = '';

  const { status, paymentMethod, amount, pricePerUnit } = paymentData;

  // Validate payment status
  const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
  if (!validPaymentStatuses.includes(status)) {
    throw new Error(`Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}`);
  }

  // Validate payment method if provided
  if (paymentMethod && !Object.values(PAYMENT_METHODS).includes(paymentMethod as any)) {
    throw new Error(`Invalid payment method. Must be one of: ${Object.values(PAYMENT_METHODS).join(', ')}`);
  }

  // Check if order exists and belongs to merchant
  const orderResult = await client.query(
    'SELECT order_id, total_amount, payment_status, status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2',
    [orderId, merchantId]
  );

  if (orderResult.rows.length === 0) {
    throw new Error('Order not found');
  }

  // Prevent changing payment status back to pending when it's already paid
  const currentPaymentStatus = orderResult.rows[0].payment_status;
  if (currentPaymentStatus === 'paid' && status === 'pending') {
    throw new Error('Cannot change payment status back to pending once order is paid');
  }

  const orderAmount = parseFloat(orderResult.rows[0].total_amount);
  const paymentAmount = amount || orderAmount;
  let newTotalAmount = orderAmount; // Default to original amount

  logger.info('Payment update - price_per_unit validation', {
    orderId: orderId,
    originalOrderAmount: orderAmount,
    requestedPaymentAmount: amount,
    finalPaymentAmount: paymentAmount,
    pricePerUnitRequested: pricePerUnit,
    amountsMatch: orderAmount === paymentAmount,
    note: 'price_per_unit changes will be applied to order items when marking as paid'
  });

  // Update price_per_unit for order items if provided and status is paid
  if (pricePerUnit !== undefined && status === 'paid') {
    logger.info('Updating price_per_unit for order items during payment', {
      orderId: orderId,
      newPricePerUnit: pricePerUnit
    });

    // Use extracted service
    newTotalAmount = await updateOrderPrices(client, orderId, merchantId, pricePerUnit);

    logger.info('Order items price_per_unit and totals updated during payment', {
      orderId: orderId,
      newPricePerUnit: pricePerUnit,
      newTotalAmount: newTotalAmount,
      note: 'total_price and total_amount recalculated based on new unit price'
    });
  }

  // Check if payment record exists
  const existingPayment = await client.query(
    'SELECT payment_id FROM oms.order_payments WHERE order_id = $1',
    [orderId]
  );

  if (existingPayment.rows.length > 0) {
    // Update existing payment
    await client.query(
      'UPDATE oms.order_payments SET status = $1, payment_method = $2, amount = $3, payment_date = CURRENT_TIMESTAMP WHERE order_id = $4',
      [status, paymentMethod || 'cash', paymentAmount, orderId]
    );
  } else {
    // Create new payment record
    await client.query(
      'INSERT INTO oms.order_payments (order_id, status, payment_method, amount, payment_date) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)',
      [orderId, status, paymentMethod || 'cash', paymentAmount]
    );
  }

  // Update orders table payment_status, payment_method, and total_amount when paid
  if (status === 'paid') {
    // Get current order status to preserve 'cancelled' status
    const currentOrderStatus = orderResult.rows[0].status;
    const newOrderStatus = currentOrderStatus === 'cancelled' ? 'cancelled' : 'confirmed';
    
    logger.info('Payment update - status preservation logic', {
      orderId: orderId,
      currentOrderStatus: currentOrderStatus,
      newOrderStatus: newOrderStatus,
      paymentStatus: status,
      preservedCancelledStatus: currentOrderStatus === 'cancelled'
    });
    
    // Update payment status, method, and conditionally change order status to 'confirmed' (except for cancelled orders)
    await client.query(
      'UPDATE oms.orders SET payment_status = $1, payment_method = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE order_id = $4 AND merchant_id = $5',
      [status, paymentMethod || 'cash', newOrderStatus, orderId, merchantId]
    );

    // Log status change to order_status_history if status changed
    if (currentOrderStatus !== newOrderStatus) {
      await client.query(
        'INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)',
        [orderId, currentOrderStatus, newOrderStatus, merchantId]
      );
      
      logger.info('Order status change logged to history', {
        orderId: orderId,
        oldStatus: currentOrderStatus,
        newStatus: newOrderStatus,
        changedBy: merchantId
      });
    }

    logger.info('Payment marked as paid - totals updated based on new unit price', {
      orderId: orderId,
      originalOrderAmount: orderAmount,
      paymentAmount: paymentAmount,
      newTotalAmount: newTotalAmount,
      totalAmountUpdated: true,
      pricePerUnitChanged: pricePerUnit !== undefined,
      newPricePerUnit: pricePerUnit
    });

    // Auto-create invoice when order is marked as paid
    try {
      console.log('🔄 Auto-creating invoice for paid order:', orderId);
      
      // Check if invoice already exists for this order
      const existingInvoice = await client.query(
        'SELECT invoice_id FROM oms.invoices WHERE order_id = $1',
        [orderId]
      );

      if (existingInvoice.rows.length === 0) {
        // Create invoice automatically
        const invoiceResult = await createInvoiceFromPaidOrder(client, orderId, merchantId, newTotalAmount);
        
        if (invoiceResult) {
          console.log('✅ Auto-created invoice:', invoiceResult.invoiceId, 'for order:', orderId);
          logger.info('Auto-created invoice for paid order', {
            orderId: orderId,
            invoiceId: invoiceResult.invoiceId,
            invoiceNumber: invoiceResult.invoiceNumber,
            displayNumber: invoiceResult.displayNumber
          });
          
          // Store invoice info for return
          invoiceCreationFailed = false;
          invoiceCreationError = '';
          
          // Return invoice info for WebSocket emission
          return {
            newTotalAmount,
            originalTotalAmount: orderAmount,
            pricePerUnitChanged: pricePerUnit !== undefined,
            newPricePerUnit: pricePerUnit,
            invoiceCreated: true,
            invoiceId: invoiceResult.invoiceId,
            invoiceNumber: invoiceResult.invoiceNumber,
            displayNumber: invoiceResult.displayNumber,
            totalAmount: invoiceResult.totalAmount,
            invoiceCreationFailed: false,
            invoiceCreationError: ''
          };
        }
      } else {
        // Invoice already exists - update its payment status to match the order
        const invoiceId = existingInvoice.rows[0].invoice_id;
        console.log('📋 Invoice already exists for order:', orderId, 'invoice_id:', invoiceId, '- updating payment status to paid');
        
        try {
          await updateInvoiceStatus(
            client,
            invoiceId,
            merchantId,
            'paid', // Invoice payment status
            paymentMethod || 'cash' // Payment method
          );
          
          console.log('✅ Updated existing invoice payment status to paid:', invoiceId);
          logger.info('Updated existing invoice payment status to paid', {
            orderId: orderId,
            invoiceId: invoiceId,
            paymentStatus: 'paid',
            paymentMethod: paymentMethod || 'cash'
          });
        } catch (updateError) {
          console.log('⚠️ Failed to update invoice payment status:', updateError);
          logger.warn('Failed to update invoice payment status', {
            orderId: orderId,
            invoiceId: existingInvoice.rows[0].invoice_id,
            error: updateError instanceof Error ? updateError.message : String(updateError)
          });
        }
      }
    } catch (invoiceError) {
      // Don't fail the payment update if invoice creation fails, but return a warning
      console.log('⚠️ Failed to auto-create invoice for order:', orderId, 'Error:', invoiceError);
      logger.warn('Failed to auto-create invoice for paid order', {
        orderId: orderId,
        error: invoiceError instanceof Error ? invoiceError.message : String(invoiceError)
      });
      
      // Set a flag to indicate invoice creation failed
      invoiceCreationFailed = true;
      invoiceCreationError = invoiceError instanceof Error ? invoiceError.message : String(invoiceError);
    }
  } else {
    // For non-paid statuses, only update payment_status and payment_method
    await client.query(
      'UPDATE oms.orders SET payment_status = $1, payment_method = $2, updated_at = CURRENT_TIMESTAMP WHERE order_id = $3 AND merchant_id = $4',
      [status, paymentMethod || 'cash', orderId, merchantId]
    );
  }

  logger.info('Payment status updated', {
    orderId: orderId,
    status,
    paymentMethod,
    amount: paymentAmount,
    totalAmountUpdated: newTotalAmount !== orderAmount,
    originalTotalAmount: orderAmount,
    finalTotalAmount: newTotalAmount,
    pricePerUnitChanged: pricePerUnit !== undefined,
    newPricePerUnit: pricePerUnit
  });

  return {
    newTotalAmount,
    originalTotalAmount: orderAmount,
    pricePerUnitChanged: pricePerUnit !== undefined,
    newPricePerUnit: pricePerUnit,
    invoiceCreationFailed,
    invoiceCreationError
  };
}

