// Database queries for invoice number generation

/**
 * Generate invoice number atomically
 */
export const generateInvoiceNumberQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      UPDATE oms.merchant_billing_details 
      SET next_invoice_number = next_invoice_number + 1 
      WHERE merchant_id = $1 
      RETURNING next_invoice_number, invoice_prefix
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get merchant billing details
 */
export const getMerchantBillingDetailsQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: 'SELECT billing_id, state_code FROM oms.merchant_billing_details WHERE merchant_id = $1',
    queryParams: [merchantId]
  };
};

