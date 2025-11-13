// Service for generating invoice numbers

import { PoolClient } from 'pg';
import * as invoiceNumberQueries from '../queries/invoice-number-queries';

/**
 * Generate invoice number atomically
 */
export async function generateInvoiceNumber(
  client: PoolClient,
  merchantId: number
): Promise<{ invoiceNumber: number; invoicePrefix: string }> {
  try {
    await client.query('BEGIN');
    
    const query = invoiceNumberQueries.generateInvoiceNumberQuery(merchantId);
    const result = await client.query(query.query, query.queryParams);
    
    if (result.rows.length === 0) {
      throw new Error('Merchant billing details not found. Please set up billing details first.');
    }
    
    await client.query('COMMIT');
    
    return {
      invoiceNumber: result.rows[0].next_invoice_number,
      invoicePrefix: result.rows[0].invoice_prefix || 'INV-'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

