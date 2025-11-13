// Merchant service for returns module

import { PoolClient } from 'pg';
import * as userQueries from '../queries/user-queries';

/**
 * Get merchant ID from user session
 */
export async function getMerchantId(
  client: PoolClient,
  userId: number
): Promise<number> {
  const query = userQueries.getMerchantIdQuery(userId);
  const result = await client.query(query.query, query.queryParams);
  
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  
  return result.rows[0].merchant_id;
}

