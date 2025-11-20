// Customer queries for public orders

/**
 * Find customer by phone and merchant
 */
export const findCustomerByPhoneQuery = (
  phone: string,
  merchantId: number
): { query: string; queryParams: any[] } => {
  const query = `
    SELECT customer_id 
    FROM oms.customers 
    WHERE phone = $1 AND merchant_id = $2
  `;
  
  return { query, queryParams: [phone, merchantId] };
};

/**
 * Update customer information
 */
export const updateCustomerQuery = (customerId: number, customerData: {
  name?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  alternatePhone?: string;
  deliveryNote?: string;
  stateCode?: string;
  gstNumber?: string;
}): { query: string; queryParams: any[] } => {
  const query = `
    UPDATE oms.customers SET
      name = COALESCE($1, name),
      email = COALESCE($2, email),
      address_line1 = COALESCE($3, address_line1),
      address_line2 = COALESCE($4, address_line2),
      landmark = COALESCE($5, landmark),
      city = COALESCE($6, city),
      state = COALESCE($7, state),
      pincode = COALESCE($8, pincode),
      country = COALESCE($9, country),
      alternate_phone = COALESCE($10, alternate_phone),
      delivery_note = COALESCE($11, delivery_note),
      state_code = COALESCE($12, state_code),
      gst_number = COALESCE($13, gst_number),
      updated_at = CURRENT_TIMESTAMP
    WHERE customer_id = $14
  `;
  
  return {
    query,
    queryParams: [
      customerData.name,
      customerData.email || null,
      customerData.addressLine1 || null,
      customerData.addressLine2 || null,
      customerData.landmark || null,
      customerData.city || null,
      customerData.state || null,
      customerData.pincode || null,
      customerData.country || 'India',
      customerData.alternatePhone || null,
      customerData.deliveryNote || null,
      customerData.stateCode || null,
      customerData.gstNumber || null,
      customerId
    ]
  };
};

/**
 * Create new customer
 */
export const createCustomerQuery = (customerData: {
  merchantId: number;
  name: string;
  phone: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  alternatePhone?: string;
  deliveryNote?: string;
  stateCode?: string;
  gstNumber?: string;
}): { query: string; queryParams: any[] } => {
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
      customerData.merchantId,
      customerData.name,
      customerData.phone,
      customerData.email || null,
      customerData.addressLine1 || '',
      customerData.addressLine2 || '',
      customerData.landmark || '',
      customerData.city || '',
      customerData.state || '',
      customerData.pincode || '',
      customerData.country || 'India',
      customerData.alternatePhone || null,
      false, // is_verified_address
      customerData.deliveryNote || '',
      customerData.stateCode || null,
      customerData.gstNumber || null
    ]
  };
};

