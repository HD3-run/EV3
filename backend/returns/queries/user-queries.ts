// User queries for returns

/**
 * Get merchant ID from user ID
 */
export const getMerchantIdQuery = (userId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT merchant_id 
    FROM oms.users 
    WHERE user_id = $1
  `;
  
  return { query, queryParams: [userId] };
};

