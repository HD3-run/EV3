import { PoolClient } from 'pg';
import { checkColumnsExist } from '../utils/columnCheck';

export interface InventoryData {
  quantity_available?: number;
  reorder_level?: number;
  cost_price?: number;
  selling_price?: number;
}

// Create inventory entry when product is created
export async function createInventoryEntry(
  client: PoolClient,
  merchantId: number,
  productId: number,
  sku: string,
  inventoryData: InventoryData
): Promise<void> {
  const { quantity_available = 0, reorder_level = 0, cost_price, selling_price } = inventoryData;
  
  // Check which columns exist in inventory table
  const columnCheck = await checkColumnsExist(client, 'oms', 'inventory', ['reserved_quantity', 'selling_price']);
  
  const inventoryColumns = ['merchant_id', 'product_id', 'sku', 'quantity_available', 'reorder_level', 'cost_price'];
  const inventoryValues: any[] = [merchantId, productId, sku, quantity_available, reorder_level, cost_price || null];
  
  if (columnCheck.selling_price) {
    inventoryColumns.push('selling_price');
    inventoryValues.push(selling_price || null);
  }
  
  if (columnCheck.reserved_quantity) {
    inventoryColumns.push('reserved_quantity');
    inventoryValues.push(0);
  }
  
  const inventoryPlaceholders = inventoryValues.map((_, i) => `$${i + 1}`).join(', ');
  
  await client.query(
    `INSERT INTO oms.inventory (${inventoryColumns.join(', ')}) VALUES (${inventoryPlaceholders})`,
    inventoryValues
  );
}

// Update inventory entry
export async function updateInventoryEntry(
  client: PoolClient,
  productId: number,
  merchantId: number,
  inventoryData: InventoryData
): Promise<void> {
  const { quantity_available, reorder_level, cost_price, selling_price } = inventoryData;
  
  if (quantity_available === undefined && reorder_level === undefined && cost_price === undefined && selling_price === undefined) {
    return; // Nothing to update
  }
  
  const inventoryUpdates: string[] = [];
  const inventoryValues: any[] = [];
  let invParamIndex = 1;

  if (quantity_available !== undefined) {
    inventoryUpdates.push(`quantity_available = $${invParamIndex}`);
    inventoryValues.push(parseInt(quantity_available.toString()) || 0);
    invParamIndex++;
  }

  if (reorder_level !== undefined) {
    inventoryUpdates.push(`reorder_level = $${invParamIndex}`);
    inventoryValues.push(parseInt(reorder_level.toString()) || 0);
    invParamIndex++;
  }

  if (cost_price !== undefined) {
    inventoryUpdates.push(`cost_price = $${invParamIndex}`);
    inventoryValues.push(parseFloat(cost_price.toString()) || null);
    invParamIndex++;
  }

  if (selling_price !== undefined) {
    inventoryUpdates.push(`selling_price = $${invParamIndex}`);
    inventoryValues.push(parseFloat(selling_price.toString()) || null);
    invParamIndex++;
  }

  if (inventoryUpdates.length > 0) {
    inventoryValues.push(productId, merchantId);
    await client.query(
      `UPDATE oms.inventory 
       SET ${inventoryUpdates.join(', ')}
       WHERE product_id = $${invParamIndex} AND merchant_id = $${invParamIndex + 1}`,
      inventoryValues
    );
  }
}

// Check if inventory entry exists
export async function inventoryEntryExists(
  client: PoolClient,
  productId: number,
  merchantId: number
): Promise<boolean> {
  const result = await client.query(
    'SELECT inventory_id FROM oms.inventory WHERE product_id = $1 AND merchant_id = $2',
    [productId, merchantId]
  );
  return result.rows.length > 0;
}

