// Database queries for invoice items

/**
 * Get invoice details with items
 */
export const getInvoiceWithItemsQuery = (
  invoiceId: number,
  merchantId: number
): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT i.*, mbd.invoice_prefix, c.name as customer_name, o.status as order_status
      FROM oms.invoices i
      LEFT JOIN oms.merchant_billing_details mbd ON i.merchant_id = mbd.merchant_id
      LEFT JOIN oms.orders o ON i.order_id = o.order_id
      LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
      WHERE i.invoice_id = $1 AND i.merchant_id = $2
    `,
    queryParams: [invoiceId, merchantId]
  };
};

/**
 * Get invoice items with product details
 */
export const getInvoiceItemsQuery = (invoiceId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT ii.*, p.product_name, p.sku
      FROM oms.invoice_items ii
      LEFT JOIN oms.products p ON ii.product_id = p.product_id
      WHERE ii.invoice_id = $1
    `,
    queryParams: [invoiceId]
  };
};

/**
 * Get invoice for PDF generation with billing details
 */
export const getInvoiceForPdfQuery = (
  invoiceId: number,
  merchantId: number
): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT 
        i.*,
        mbd.invoice_prefix,
        mbd.invoice_logo_url,
        mbd.gst_number,
        mbd.pan_number,
        mbd.billing_address_line1,
        mbd.billing_address_line2,
        mbd.billing_city,
        mbd.billing_state,
        mbd.billing_pincode,
        mbd.billing_country,
        mbd.bank_name,
        mbd.bank_account_number,
        mbd.ifsc_code,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        c.address as customer_address,
        o.status as order_status
      FROM oms.invoices i
      LEFT JOIN oms.merchant_billing_details mbd ON i.merchant_id = mbd.merchant_id
      LEFT JOIN oms.orders o ON i.order_id = o.order_id
      LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
      WHERE i.invoice_id = $1 AND i.merchant_id = $2
    `,
    queryParams: [invoiceId, merchantId]
  };
};

