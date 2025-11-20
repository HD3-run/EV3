// Database queries for user/merchant information

/**
 * Get user merchant ID
 */
export const getUserMerchantIdQuery = (userId: number): { query: string; queryParams: any[] } => {
  return {
    query: 'SELECT merchant_id FROM oms.users WHERE user_id = $1',
    queryParams: [userId]
  };
};

/**
 * Get user with merchant ID (for debug)
 */
export const getUserWithMerchantQuery = (userId: number): { query: string; queryParams: any[] } => {
  return {
    query: 'SELECT user_id, merchant_id, username FROM oms.users WHERE user_id = $1',
    queryParams: [userId]
  };
};

