// Merchant info queries for public catalog

/**
 * Get merchant info by merchant_id
 */
export const getMerchantInfoQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT merchant_id, merchant_name as business_name, email, phone_number, contact_person_name
    FROM oms.merchants 
    WHERE merchant_id = $1
  `;
  
  return { query, queryParams: [merchantId] };
};

