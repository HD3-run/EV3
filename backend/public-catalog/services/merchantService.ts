import { Pool } from 'pg';
import { logger } from '../../utils/logger';
import { getMerchantInfoQuery } from '../queries/mrcnt-info-queries';

export interface MerchantServiceResult {
  success: boolean;
  merchant?: any;
  error?: string;
}

export async function getMerchantInfo(
  pool: Pool,
  merchantId: number
): Promise<MerchantServiceResult> {
  try {
    const query = getMerchantInfoQuery(merchantId);
    const result = await pool.query(query.query, query.queryParams);

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Merchant not found',
      };
    }

    return {
      success: true,
      merchant: result.rows[0],
    };
  } catch (error) {
    logger.error('Error fetching merchant:', error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: 'Failed to fetch merchant information',
    };
  }
}

