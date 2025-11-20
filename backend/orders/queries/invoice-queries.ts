// Invoice-related database queries

/**
 * Get merchant billing details with state code
 */
export const getMerchantBillingDetails = (merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT billing_id, next_invoice_number, invoice_prefix, state_code 
    FROM oms.merchant_billing_details 
    WHERE merchant_id = $1
  `;
  
  return { query, queryParams: [merchantId] };
};

/**
 * Update next_invoice_number atomically
 */
export const updateNextInvoiceNumber = (merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    UPDATE oms.merchant_billing_details 
    SET next_invoice_number = next_invoice_number + 1 
    WHERE merchant_id = $1 
    RETURNING next_invoice_number
  `;
  
  return { query, queryParams: [merchantId] };
};

/**
 * Get order items with product GST details
 */
export const getOrderItemsWithGst = (orderId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT oi.order_item_id, oi.product_id, oi.inventory_id, oi.quantity, oi.price_per_unit, oi.total_price,
           p.hsn_code, p.gst_rate
    FROM oms.order_items oi 
    LEFT JOIN oms.products p ON oi.product_id = p.product_id
    WHERE oi.order_id = $1
  `;
  
  return { query, queryParams: [orderId] };
};

/**
 * Create invoice header with GST breakdown
 */
export const createInvoiceHeader = (
  invoiceNumber: number,
  orderId: number,
  merchantId: number,
  billingId: number,
  dueDate: Date,
  subtotal: number,
  totalGst: number,
  totalCgst: number,
  totalSgst: number,
  totalIgst: number,
  finalTotalAmount: number
): { query: string; queryParams: any[] } => {
  const query = `
    INSERT INTO oms.invoices 
    (invoice_number, order_id, merchant_id, billing_id, invoice_date, due_date, 
     subtotal, tax_amount, discount_amount, total_amount, cgst_amount, sgst_amount, igst_amount, payment_status, notes)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8, $9, $10, $11, $12, 'paid', $13)
    RETURNING *
  `;
  
  return {
    query,
    queryParams: [
      invoiceNumber,
      orderId,
      merchantId,
      billingId,
      dueDate,
      subtotal,
      totalGst,
      0, // discount_amount
      finalTotalAmount,
      totalCgst,
      totalSgst,
      totalIgst,
      'Auto-generated invoice for paid order'
    ]
  };
};

/**
 * Insert invoice items with GST breakdown
 */
export const insertInvoiceItem = (
  invoiceId: number,
  orderItemId: number,
  productId: number,
  inventoryId: number | null,
  quantity: number,
  unitPrice: number,
  totalPrice: number,
  hsnCode: string | null,
  gstRate: number,
  cgstAmount: number,
  sgstAmount: number,
  igstAmount: number
): { query: string; queryParams: any[] } => {
  const query = `
    INSERT INTO oms.invoice_items 
    (invoice_id, order_item_id, product_id, inventory_id, quantity, unit_price, total_amount, 
     hsn_code, gst_rate, cgst_amount, sgst_amount, igst_amount)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `;
  
  return {
    query,
    queryParams: [
      invoiceId,
      orderItemId,
      productId,
      inventoryId,
      quantity,
      unitPrice,
      totalPrice,
      hsnCode,
      gstRate,
      cgstAmount,
      sgstAmount,
      igstAmount
    ]
  };
};

/**
 * Check if invoice already exists for order
 */
export const checkInvoiceExists = (orderId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT invoice_id 
    FROM oms.invoices 
    WHERE order_id = $1
  `;
  
  return { query, queryParams: [orderId] };
};

