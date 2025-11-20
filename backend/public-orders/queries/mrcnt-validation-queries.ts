// Merchant validation queries for public orders

/**
 * Check if merchant exists
 */
export const checkMerchantExistsQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT merchant_id 
    FROM oms.merchants 
    WHERE merchant_id = $1
  `;
  
  return { query, queryParams: [merchantId] };
};

