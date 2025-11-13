// Customer-related database queries

/**
 * Find customer by phone and merchant
 */
export const findCustomerByPhone = (phone: string, merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT customer_id 
    FROM oms.customers 
    WHERE phone = $1 AND merchant_id = $2
  `;
  
  return { query, queryParams: [phone, merchantId] };
};

/**
 * Update existing customer with new address details
 */
export const updateCustomerDetails = (
  customerId: number,
  merchantId: number,
  customerName: string,
  customerEmail: string,
  addressLine1: string,
  addressLine2: string,
  landmark: string,
  city: string,
  state: string,
  pincode: string,
  country: string,
  alternatePhone: string,
  isVerifiedAddress: boolean,
  deliveryNote: string,
  stateCode: string | null,
  gstNumber: string | null
): { query: string; queryParams: any[] } => {
  const query = `
    UPDATE oms.customers SET 
      name = $1, 
      email = $2, 
      address_line1 = $3, 
      address_line2 = $4, 
      landmark = $5, 
      city = $6, 
      state = $7, 
      pincode = $8, 
      country = $9, 
      alternate_phone = $10, 
      is_verified_address = $11, 
      delivery_note = $12,
      state_code = $13,
      gst_number = $14,
      updated_at = CURRENT_TIMESTAMP
    WHERE customer_id = $15 AND merchant_id = $16
  `;
  
  return {
    query,
    queryParams: [
      customerName,
      customerEmail,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      pincode,
      country || 'India',
      alternatePhone,
      isVerifiedAddress || false,
      deliveryNote,
      stateCode || null,
      gstNumber || null,
      customerId,
      merchantId
    ]
  };
};

/**
 * Create new customer with detailed address information
 */
export const createCustomer = (
  merchantId: number,
  customerName: string,
  customerPhone: string,
  customerEmail: string,
  addressLine1: string,
  addressLine2: string,
  landmark: string,
  city: string,
  state: string,
  pincode: string,
  country: string,
  alternatePhone: string,
  isVerifiedAddress: boolean,
  deliveryNote: string,
  stateCode: string | null,
  gstNumber: string | null
): { query: string; queryParams: any[] } => {
  const query = `
    INSERT INTO oms.customers (
      merchant_id, name, phone, email, 
      address_line1, address_line2, landmark, city, state, pincode, country, 
      alternate_phone, is_verified_address, delivery_note, state_code, gst_number
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
    RETURNING customer_id
  `;
  
  return {
    query,
    queryParams: [
      merchantId,
      customerName,
      customerPhone,
      customerEmail,
      addressLine1 || '',
      addressLine2 || '',
      landmark || '',
      city || '',
      state || '',
      pincode || '',
      country || 'India',
      alternatePhone || '',
      isVerifiedAddress || false,
      deliveryNote || '',
      stateCode || null,
      gstNumber || null
    ]
  };
};

/**
 * Batch find customers by phones
 */
export const findCustomersByPhones = (phones: string[], merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT customer_id, phone 
    FROM oms.customers 
    WHERE phone = ANY($1) AND merchant_id = $2
  `;
  
  return { query, queryParams: [phones, merchantId] };
};

/**
 * Batch create customers (with conflict handling)
 */
export const batchCreateCustomers = (
  customers: Array<{
    merchantId: number;
    name: string;
    phone: string;
    email: string;
    address: string;
    state: string;
    stateCode: string | null;
    gstNumber: string | null;
  }>
): { query: string; queryParams: any[] } => {
  const customerValues = customers.map((_, index) => 
    `($${index * 8 + 1}, $${index * 8 + 2}, $${index * 8 + 3}, $${index * 8 + 4}, $${index * 8 + 5}, $${index * 8 + 6}, $${index * 8 + 7}, $${index * 8 + 8})`
  ).join(', ');
  
  const customerParams = customers.flatMap(customer => [
    customer.merchantId,
    (customer.name || '').substring(0, 255),
    (customer.phone || '').substring(0, 20),
    (customer.email || '').substring(0, 255),
    customer.address || '',
    customer.state || '',
    customer.stateCode || null,
    customer.gstNumber || null
  ]);
  
  const query = `
    INSERT INTO oms.customers (merchant_id, name, phone, email, address, state, state_code, gst_number) 
    VALUES ${customerValues} 
    ON CONFLICT (merchant_id, phone) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      address = EXCLUDED.address,
      state = EXCLUDED.state,
      state_code = EXCLUDED.state_code,
      gst_number = EXCLUDED.gst_number
    RETURNING customer_id, phone
  `;
  
  return { query, queryParams: customerParams };
};

