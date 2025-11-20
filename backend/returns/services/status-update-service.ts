// Status update service for returns module

import { PoolClient } from 'pg';
import { logger } from '../../utils/logger';

export interface StatusUpdateFields {
  approval_status?: string;
  receipt_status?: string;
  status?: string;
}

export interface StatusUpdateResult {
  updates: string[];
  values: any[];
  paramIndex: number;
}

/**
 * Validate status values
 */
export function validateStatusValues(fields: StatusUpdateFields): {
  isValid: boolean;
  error?: string;
} {
  if (fields.approval_status !== undefined) {
    const validApprovalStatuses = ['pending', 'approved', 'rejected'];
    if (!validApprovalStatuses.includes(fields.approval_status)) {
      return {
        isValid: false,
        error: `Invalid approval_status. Must be one of: ${validApprovalStatuses.join(', ')}`
      };
    }
  }

  if (fields.receipt_status !== undefined) {
    const validReceiptStatuses = ['pending', 'received', 'inspected', 'rejected'];
    if (!validReceiptStatuses.includes(fields.receipt_status)) {
      return {
        isValid: false,
        error: `Invalid receipt_status. Must be one of: ${validReceiptStatuses.join(', ')}`
      };
    }
  }

  if (fields.status !== undefined) {
    const validStatuses = ['pending', 'processed'];
    if (!validStatuses.includes(fields.status)) {
      return {
        isValid: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      };
    }
  }

  return { isValid: true };
}

/**
 * Build status update query parts
 */
export function buildStatusUpdateParts(fields: StatusUpdateFields): StatusUpdateResult {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (fields.approval_status !== undefined) {
    updates.push(`approval_status = $${paramIndex++}`);
    values.push(fields.approval_status);

    // If approval_status is set to 'rejected', automatically set receipt_status to 'rejected'
    if (fields.approval_status === 'rejected') {
      updates.push(`receipt_status = $${paramIndex++}`);
      values.push('rejected');
    }
  }

  if (fields.receipt_status !== undefined) {
    updates.push(`receipt_status = $${paramIndex++}`);
    values.push(fields.receipt_status);
  }

  if (fields.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(fields.status);
  }

  // Add updated_at
  updates.push('updated_at = NOW()');

  return { updates, values, paramIndex };
}

/**
 * Update return status (single return)
 */
export async function updateReturnStatus(
  client: PoolClient,
  returnId: number,
  merchantId: number,
  fields: StatusUpdateFields
): Promise<any> {
  // Validate status values
  const validation = validateStatusValues(fields);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // Build update parts
  const { updates, values } = buildStatusUpdateParts(fields);

  if (updates.length === 0) {
    throw new Error('No valid status fields provided');
  }

  // Build query with proper parameter placeholders
  const allValues = [...values, returnId, merchantId];
  const query = `
    UPDATE oms.order_returns 
    SET ${updates.join(', ')} 
    WHERE return_id = $${allValues.length - 1} AND merchant_id = $${allValues.length} 
    RETURNING *
  `;

  logger.info('Executing return status update query', {
    returnId,
    merchantId,
    query: query.replace(/\s+/g, ' ').trim(),
    values: allValues,
    updates: updates.join(', ')
  });

  const result = await client.query(query, allValues);

  if (result.rows.length === 0) {
    throw new Error('Return not found or not associated with your merchant');
  }

  logger.info('Return status update query executed successfully', {
    returnId,
    updatedRow: result.rows[0],
    receipt_status: result.rows[0].receipt_status,
    approval_status: result.rows[0].approval_status,
    status: result.rows[0].status
  });

  // Log the update
  const logData: any = { returnId, merchantId };
  if (fields.approval_status !== undefined) logData.approvalStatus = fields.approval_status;
  if (fields.receipt_status !== undefined) {
    logData.receiptStatus = fields.receipt_status;
    logData.note = 'INVENTORY RESTOCK TRIGGERED by receipt_status update!';
  }
  if (fields.status !== undefined) logData.status = fields.status;

  logger.info('Return status updated', logData);

  return result.rows[0];
}

/**
 * Update return status (bulk returns)
 */
export async function bulkUpdateReturnStatus(
  client: PoolClient,
  returnIds: number[],
  merchantId: number,
  fields: StatusUpdateFields
): Promise<number[]> {
  // Validate status values
  const validation = validateStatusValues(fields);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // Build update parts
  const { updates, values } = buildStatusUpdateParts(fields);

  if (updates.length === 0) {
    throw new Error('No valid status fields provided');
  }

  // Build query with proper parameter placeholders
  const allValues = [...values, returnIds, merchantId];
  const query = `
    UPDATE oms.order_returns 
    SET ${updates.join(', ')} 
    WHERE return_id = ANY($${allValues.length - 1}) AND merchant_id = $${allValues.length} 
    RETURNING return_id
  `;

  const result = await client.query(query, allValues);

  logger.info('Bulk return status update completed', {
    returnIds,
    updatedCount: result.rows.length,
    merchantId,
    updates: fields
  });

  return result.rows.map(row => row.return_id);
}

