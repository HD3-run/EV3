// CSV processing service - Business logic for CSV upload

import { PoolClient } from 'pg';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { logger } from '../../utils/logger';
import * as productQueries from '../queries/product-queries';
import * as customerQueries from '../queries/customer-queries';
import * as orderItemQueries from '../queries/order-item-queries';

export interface CSVOrderRow {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerState: string;
  customerStateCode: string | null;
  customerGstNumber: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  orderSource: string;
  totalAmount: number;
}

/**
 * Parse CSV file into order rows
 */
export async function parseCSVOrders(fileBuffer: Buffer): Promise<{ orders: CSVOrderRow[]; errors: string[] }> {
  const orders: CSVOrderRow[] = [];
  const errors: string[] = [];

  const stream = Readable.from(fileBuffer.toString());
  
  await new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (row) => {
        try {
          const order: CSVOrderRow = {
            customerName: row.customer_name || row['Customer Name'],
            customerPhone: row.customer_phone || row['Customer Phone'],
            customerEmail: row.customer_email || row['Customer Email'],
            customerAddress: row.customer_address || row['Customer Address'],
            customerState: row.customer_state || row['Customer State'] || '',
            customerStateCode: row.customer_state_code || row['Customer State Code'] || null,
            customerGstNumber: row.customer_gst_number || row['Customer GST Number'] || null,
            productName: row.product_name || row['Product Name'],
            quantity: parseInt(row.quantity || row['Quantity'], 10),
            unitPrice: parseFloat(row.unit_price || row['Unit Price']),
            orderSource: row.order_source || row['Order Source'] || 'CSV',
            totalAmount: 0
          };

          order.totalAmount = order.quantity * order.unitPrice;
          orders.push(order);
        } catch (error) {
          errors.push(`Error parsing row: ${JSON.stringify(row)} - ${error}`);
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  return { orders, errors };
}

/**
 * Process batch of orders (500 per batch)
 */
export async function processOrderBatch(
  client: PoolClient,
  batch: CSVOrderRow[],
  merchantId: number,
  userId: number
): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  
  // Step 1: Batch validate products
  const productNames = batch.map(order => order.productName);
  const productValidationQuery = productQueries.batchValidateProducts(productNames, merchantId);
  const productValidationResult = await client.query(productValidationQuery.query, productValidationQuery.queryParams);
  
  const availableProducts = new Map();
  productValidationResult.rows.forEach(row => {
    availableProducts.set(row.product_name, {
      productId: row.product_id,
      inventoryId: row.inventory_id,
      availableStock: row.quantity_available,
      costPrice: row.cost_price,
      sku: row.sku
    });
  });
  
  // Step 2: Filter valid orders
  const validOrders: Array<CSVOrderRow & { productInfo: any }> = [];
  for (const orderData of batch) {
    const productInfo = availableProducts.get(orderData.productName);
    if (!productInfo) {
      errors.push(`Product "${orderData.productName}" not found in inventory. Please add it to inventory first.`);
      continue;
    }
    if (productInfo.availableStock <= 0 || productInfo.availableStock < orderData.quantity) {
      errors.push(`Insufficient stock for "${orderData.productName}". Available: ${productInfo.availableStock}, Required: ${orderData.quantity}`);
      continue;
    }
    validOrders.push({ ...orderData, productInfo });
  }
  
  if (validOrders.length === 0) {
    return { created: 0, errors };
  }
  
  // Step 3: Batch create/find customers
  const customerPhones = validOrders.map(order => order.customerPhone);
  const existingCustomersQuery = customerQueries.findCustomersByPhones(customerPhones, merchantId);
  const existingCustomersResult = await client.query(existingCustomersQuery.query, existingCustomersQuery.queryParams);
  
  const existingCustomers = new Map();
  existingCustomersResult.rows.forEach(row => {
    existingCustomers.set(row.phone, row.customer_id);
  });
  
  // Step 4: Batch insert new customers
  const newCustomers = validOrders.filter(order => !existingCustomers.has(order.customerPhone));
  if (newCustomers.length > 0) {
    const uniqueCustomers = new Map();
    newCustomers.forEach(order => {
      if (!uniqueCustomers.has(order.customerPhone)) {
        uniqueCustomers.set(order.customerPhone, order);
      }
    });
    
    const uniqueCustomerArray = Array.from(uniqueCustomers.values());
    const batchCustomerQuery = customerQueries.batchCreateCustomers(
      uniqueCustomerArray.map(order => ({
        merchantId,
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
        address: order.customerAddress,
        state: order.customerState,
        stateCode: order.customerStateCode,
        gstNumber: order.customerGstNumber
      }))
    );
    
    const newCustomersResult = await client.query(batchCustomerQuery.query, batchCustomerQuery.queryParams);
    newCustomersResult.rows.forEach(row => {
      existingCustomers.set(row.phone, row.customer_id);
    });
  }
  
  // Step 5: Batch create orders
  const orderValues = validOrders.map((_, index) => 
    `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5})`
  ).join(', ');
  
  const orderParams = validOrders.flatMap(order => [
    merchantId,
    existingCustomers.get(order.customerPhone),
    (order.orderSource || 'csv_upload').substring(0, 50),
    order.totalAmount || 0,
    'pending'
  ]);
  
  const ordersQuery = `
    INSERT INTO oms.orders (merchant_id, customer_id, order_source, total_amount, status) 
    VALUES ${orderValues} 
    RETURNING order_id, customer_id, total_amount, status
  `;
  
  const ordersResult = await client.query(ordersQuery, orderParams);
  
  // Step 6: Batch create order items
  const batchOrderItemsQuery = orderItemQueries.batchCreateOrderItems(
    validOrders.map((order, index) => ({
      orderId: ordersResult.rows[index].order_id,
      productId: order.productInfo.productId,
      inventoryId: order.productInfo.inventoryId,
      sku: order.productInfo.sku || '',
      quantity: order.quantity,
      pricePerUnit: order.unitPrice,
      totalPrice: order.quantity * order.unitPrice
    }))
  );
  await client.query(batchOrderItemsQuery.query, batchOrderItemsQuery.queryParams);
  
  // Step 7: Batch update inventory
  const inventoryUpdates = new Map();
  validOrders.forEach(order => {
    const key = order.productInfo.productId;
    if (inventoryUpdates.has(key)) {
      inventoryUpdates.set(key, inventoryUpdates.get(key) + order.quantity);
    } else {
      inventoryUpdates.set(key, order.quantity);
    }
  });
  
  for (const [productId, totalQuantity] of inventoryUpdates) {
    const inventoryQuery = productQueries.updateInventoryQuantity(productId, merchantId, totalQuantity);
    await client.query(inventoryQuery.query, inventoryQuery.queryParams);
  }
  
  // Step 8: Batch create order status history
  const historyValues = ordersResult.rows.map((_, index) => 
    `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
  ).join(', ');
  
  const historyParams = ordersResult.rows.flatMap(order => [
    order.order_id,
    null,
    'pending',
    userId
  ]);
  
  const historyQuery = `
    INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) 
    VALUES ${historyValues}
  `;
  
  await client.query(historyQuery, historyParams);
  
  return { created: ordersResult.rows.length, errors };
}

/**
 * Process CSV upload with batch processing and WebSocket progress updates
 */
export async function processCSVUpload(
  client: PoolClient,
  orders: CSVOrderRow[],
  merchantId: number,
  userId: number,
  uploadId: string
): Promise<{ created: number; errors: string[] }> {
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(orders.length / BATCH_SIZE);
  const createdOrders: any[] = [];
  const allErrors: string[] = [];

  logger.info('Starting BATCH PROCESSING for orders', { 
    totalOrders: orders.length, 
    batchSize: BATCH_SIZE,
    totalBatches,
    merchantId 
  });

  // Emit initial progress event
  emitProgressUpdate(uploadId, 0, orders.length, 0, 'Starting order processing...', allErrors, false, totalBatches, 1);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * BATCH_SIZE;
    const endIndex = Math.min(startIndex + BATCH_SIZE, orders.length);
    const batch = orders.slice(startIndex, endIndex);
    
    try {
      logger.info('Processing orders batch', { 
        batchIndex: batchIndex + 1, 
        totalBatches, 
        batchSize: batch.length,
        startIndex,
        endIndex 
      });

      // Emit batch progress update
      emitProgressUpdate(
        uploadId,
        Math.round((startIndex / orders.length) * 100),
        orders.length,
        startIndex,
        `Processing orders batch ${batchIndex + 1}/${totalBatches} (${batch.length} orders)`,
        [...allErrors],
        false,
        totalBatches,
        batchIndex + 1,
        batch.length
      );

      // Process batch in transaction
      await client.query('BEGIN');
      
      const batchResult = await processOrderBatch(client, batch, merchantId, userId);
      
      createdOrders.push(...Array(batchResult.created).fill(null)); // Track created count
      allErrors.push(...batchResult.errors);
      
      await client.query('COMMIT');

      logger.info('Orders batch processed successfully', { 
        batchIndex: batchIndex + 1, 
        batchSize: batch.length,
        validOrders: batch.length,
        totalProcessed: createdOrders.length,
        errors: allErrors.length
      });

      // Emit batch completion progress
      emitProgressUpdate(
        uploadId,
        Math.round((endIndex / orders.length) * 100),
        orders.length,
        endIndex,
        `Completed orders batch ${batchIndex + 1}/${totalBatches}`,
        [...allErrors],
        false,
        totalBatches,
        batchIndex + 1,
        batch.length
      );

    } catch (error: any) {
      // Rollback batch transaction on error
      await client.query('ROLLBACK');
      
      console.error('Error processing orders batch:', error);
      logger.error('Error processing orders batch', { 
        batchIndex: batchIndex + 1, 
        batchSize: batch.length,
        error: error instanceof Error ? error.message : String(error),
        errorCode: error.code,
        errorDetail: error.detail
      });
      
      // Add individual items from failed batch to errors
      batch.forEach((orderData) => {
        allErrors.push(`Error creating order for ${orderData.customerName}: ${String(error)}`);
      });
    }
  }

  // Emit final progress event
  emitProgressUpdate(
    uploadId,
    100,
    orders.length,
    createdOrders.length,
    `Completed! Created ${createdOrders.length} orders`,
    allErrors,
    true,
    totalBatches,
    totalBatches
  );

  logger.info('CSV orders processed', { 
    totalRows: orders.length, 
    created: createdOrders.length, 
    errors: allErrors.length 
  });

  return { created: createdOrders.length, errors: allErrors };
}

/**
 * Emit WebSocket progress update
 */
function emitProgressUpdate(
  uploadId: string,
  progress: number,
  totalItems: number,
  processedItems: number,
  currentItem: string,
  errors: string[],
  completed: boolean,
  totalBatches?: number,
  currentBatch?: number,
  batchSize?: number
) {
  if ((global as any).io) {
    const progressData: any = {
      uploadId: uploadId,
      progress: progress,
      totalItems: totalItems,
      processedItems: processedItems,
      currentItem: currentItem,
      errors: errors,
      completed: completed,
      status: completed ? 'completed' : 'processing'
    };

    if (totalBatches !== undefined) {
      progressData.batchProcessing = true;
      progressData.totalBatches = totalBatches;
      if (currentBatch !== undefined) {
        progressData.currentBatch = currentBatch;
      }
      if (batchSize !== undefined) {
        progressData.batchSize = batchSize;
      }
    }

    if (completed) {
      progressData.created = processedItems;
      progressData.errorDetails = errors;
      progressData.successMessage = `Successfully processed ${processedItems} orders${errors.length > 0 ? ` with ${errors.length} errors` : ''}`;
    }

    console.log('Emitting progress update:', progressData);
    (global as any).io.emit('csv-upload-progress', progressData);
  } else {
    console.log('❌ Global io not available for progress tracking');
  }
}

/**
 * Emit error progress event
 */
export function emitErrorProgress(uploadId: string, error: string) {
  if ((global as any).io) {
    const errorProgressData = {
      uploadId: uploadId,
      progress: 0,
      totalItems: 0,
      processedItems: 0,
      currentItem: 'Upload failed',
      status: 'error',
      error: error
    };
    console.log('Emitting error progress event:', errorProgressData);
    (global as any).io.emit('csv-upload-progress', errorProgressData);
  }
}

