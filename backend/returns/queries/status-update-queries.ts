// Status update queries for returns module

/**
 * Build dynamic status update query for single return
 */
export const buildStatusUpdateQuery = (
  updates: string[],
  returnId: number,
  merchantId: number
): { query: string; queryParams: any[] } => {
  const query = `
    UPDATE oms.order_returns 
    SET ${updates.join(', ')} 
    WHERE return_id = $${updates.length + 1} AND merchant_id = $${updates.length + 2} 
    RETURNING *
  `;
  
  return { 
    query, 
    queryParams: [returnId, merchantId] 
  };
};

/**
 * Build dynamic status update query for bulk returns
 */
export const buildBulkStatusUpdateQuery = (
  updates: string[],
  returnIds: number[],
  merchantId: number
): { query: string; queryParams: any[] } => {
  const query = `
    UPDATE oms.order_returns 
    SET ${updates.join(', ')} 
    WHERE return_id = ANY($${updates.length + 1}) AND merchant_id = $${updates.length + 2} 
    RETURNING return_id
  `;
  
  return { 
    query, 
    queryParams: [returnIds, merchantId] 
  };
};

