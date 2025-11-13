// Invoice update service

import { PoolClient } from 'pg';
import { PAYMENT_METHODS } from '../../utils/constants';
import { logger } from '../../utils/logger';

export interface UpdateInvoiceData {
  dueDate?: string;
  notes?: string;
  taxAmount?: number;
  discountAmount?: number;
  paymentStatus?: string;
  paymentMethod?: string;
}

/**
 * Validate payment status
 */
export function validatePaymentStatus(paymentStatus?: string): void {
  if (paymentStatus) {
    const validStatuses = ['unpaid', 'paid', 'partially_paid', 'cancelled'];
    if (!validStatuses.includes(paymentStatus)) {
      throw new Error(`Invalid payment status. Must be one of: ${validStatuses.join(', ')}`);
    }
  }
}

/**
 * Validate payment method
 */
export function validatePaymentMethod(paymentMethod?: string): void {
  if (paymentMethod && !Object.values(PAYMENT_METHODS).includes(paymentMethod)) {
    throw new Error(`Invalid payment method. Must be one of: ${Object.values(PAYMENT_METHODS).join(', ')}`);
  }
}

/**
 * Get current invoice for update
 */
export async function getCurrentInvoice(
  client: PoolClient,
  invoiceId: number,
  merchantId: number
): Promise<any> {
  const result = await client.query(
    'SELECT invoice_id, subtotal, tax_amount, discount_amount, total_amount FROM oms.invoices WHERE invoice_id = $1 AND merchant_id = $2',
    [invoiceId, merchantId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Invoice not found');
  }
  
  return result.rows[0];
}

/**
 * Calculate new total amount preserving GST
 */
export function calculateNewTotalAmount(
  currentInvoice: any,
  discountAmount?: number
): number {
  if (discountAmount === undefined) {
    return currentInvoice.total_amount;
  }
  
  const subtotal = parseFloat(currentInvoice.subtotal);
  const existingTax = parseFloat(currentInvoice.tax_amount);
  const newDiscountAmount = parseFloat(discountAmount.toString()) || 0;
  
  return subtotal + existingTax - newDiscountAmount;
}

/**
 * Build update query dynamically
 */
export function buildUpdateQuery(
  invoiceId: number,
  merchantId: number,
  updateData: UpdateInvoiceData,
  newTotalAmount: number
): { query: string; queryParams: any[] } {
  const updateFields: string[] = [];
  const updateValues: any[] = [];
  let paramCount = 1;
  
  if (updateData.dueDate !== undefined) {
    updateFields.push(`due_date = $${paramCount}`);
    updateValues.push(updateData.dueDate);
    paramCount++;
  }
  
  if (updateData.notes !== undefined) {
    updateFields.push(`notes = $${paramCount}`);
    updateValues.push(updateData.notes);
    paramCount++;
  }
  
  if (updateData.taxAmount !== undefined) {
    updateFields.push(`tax_amount = $${paramCount}`);
    updateValues.push(updateData.taxAmount);
    paramCount++;
  }
  
  if (updateData.discountAmount !== undefined) {
    updateFields.push(`discount_amount = $${paramCount}`);
    updateValues.push(updateData.discountAmount);
    paramCount++;
  }
  
  if (updateData.paymentStatus !== undefined) {
    updateFields.push(`payment_status = $${paramCount}`);
    updateValues.push(updateData.paymentStatus);
    paramCount++;
  }
  
  if (updateData.paymentMethod !== undefined) {
    updateFields.push(`payment_method = $${paramCount}`);
    updateValues.push(updateData.paymentMethod);
    paramCount++;
  }
  
  // Always update total_amount and updated_at
  updateFields.push(`total_amount = $${paramCount}`);
  updateValues.push(newTotalAmount);
  paramCount++;
  
  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
  
  // Add invoice_id and merchant_id for WHERE clause
  updateValues.push(invoiceId, merchantId);
  
  const query = `
    UPDATE oms.invoices 
    SET ${updateFields.join(', ')}
    WHERE invoice_id = $${paramCount} AND merchant_id = $${paramCount + 1}
    RETURNING *
  `;
  
  return { query, queryParams: updateValues };
}

/**
 * Update invoice status only
 */
export async function updateInvoiceStatus(
  client: PoolClient,
  invoiceId: number,
  merchantId: number,
  paymentStatus?: string,
  paymentMethod?: string
): Promise<any> {
  validatePaymentStatus(paymentStatus);
  validatePaymentMethod(paymentMethod);
  
  const result = await client.query(
    `UPDATE oms.invoices 
     SET payment_status = COALESCE($1, payment_status), 
         payment_method = COALESCE($2, payment_method), 
         updated_at = CURRENT_TIMESTAMP
     WHERE invoice_id = $3 AND merchant_id = $4
     RETURNING *`,
    [paymentStatus, paymentMethod, invoiceId, merchantId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Invoice not found');
  }
  
  return result.rows[0];
}

/**
 * Update invoice details
 */
export async function updateInvoiceDetails(
  client: PoolClient,
  invoiceId: number,
  merchantId: number,
  updateData: UpdateInvoiceData
): Promise<any> {
  validatePaymentStatus(updateData.paymentStatus);
  validatePaymentMethod(updateData.paymentMethod);
  
  // Get current invoice
  const currentInvoice = await getCurrentInvoice(client, invoiceId, merchantId);
  
  // Calculate new total amount
  const newTotalAmount = calculateNewTotalAmount(currentInvoice, updateData.discountAmount);
  
  // Build and execute update query
  const { query, queryParams } = buildUpdateQuery(invoiceId, merchantId, updateData, newTotalAmount);
  const result = await client.query(query, queryParams);
  
  if (result.rows.length === 0) {
    throw new Error('Failed to update invoice');
  }
  
  logger.info('Invoice updated successfully', { invoiceId, updatedFields: Object.keys(updateData) });
  
  return result.rows[0];
}

