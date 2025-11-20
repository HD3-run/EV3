// CSV service - handles CSV parsing and batch processing
import { Readable } from 'stream';
import csv from 'csv-parser';
import { logger } from '../../utils/logger';
import { getUserMerchantId } from '../queries/product-queries';
import {
  updateInventoryByProductName,
  updateInventoryBySku
} from '../queries/inventory-queries';
import {
  batchInsertProducts,
  batchInsertInventory
} from '../queries/csv-queries';

const BATCH_SIZE = 500;

export async function parseStockUpdateCSV(fileBuffer: Buffer): Promise<{
  products: Array<{
    name?: string;
    sku?: string;
    stock: number;
  }>;
  errors: string[];
}> {
  const products: any[] = [];
  const errors: string[] = [];

  const stream = Readable.from(fileBuffer.toString());

  await new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (row) => {
        try {
          const product = {
            name: row.product_name || row['Product Name'],
            sku: row.sku || row['SKU'],
            stock: parseInt(row.stock || row['Stock']) || 0
          };

          if (!product.name && !product.sku) {
            errors.push(`Missing product name and SKU in row: ${JSON.stringify(row)}`);
            return;
          }

          if (product.stock < 0) {
            errors.push(`Invalid stock quantity (${product.stock}) in row: ${JSON.stringify(row)}`);
            return;
          }

          products.push(product);
        } catch (error) {
          errors.push(`Error parsing row: ${JSON.stringify(row)} - ${error}`);
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  return { products, errors };
}

export async function processStockUpdateCSV(
  client: any,
  userId: string,
  fileBuffer: Buffer,
  uploadId: string
): Promise<{
  updated: number;
  errors: string[];
  errorDetails: string[];
}> {
  const merchantId = await getUserMerchantId(client, userId);
  if (!merchantId) {
    throw new Error('User not found');
  }

  const { products, errors: parseErrors } = await parseStockUpdateCSV(fileBuffer);

  if (products.length === 0) {
    throw new Error('No valid products found in CSV');
  }

  await client.query('BEGIN');

  // Emit initial progress
  emitProgress(uploadId, 0, 'Starting stock update...', products.length, 0, parseErrors, false);

  const updatedProducts: any[] = [];
  const allErrors = [...parseErrors];

  for (let i = 0; i < products.length; i++) {
    const productData = products[i];
    try {
      // Emit progress update
      emitProgress(
        uploadId,
        Math.round((i / products.length) * 100),
        productData.name || productData.sku || 'Unknown',
        products.length,
        i,
        allErrors,
        false
      );

      let updateResult;

      // Try to update by product name first
      if (productData.name) {
        updateResult = await updateInventoryByProductName(
          client,
          productData.name,
          merchantId,
          productData.stock
        );
      } else if (productData.sku) {
        // Update by SKU
        updateResult = await updateInventoryBySku(
          client,
          productData.sku,
          merchantId,
          productData.stock
        );
      }

      if (updateResult) {
        updatedProducts.push({
          productId: updateResult.product_id,
          sku: updateResult.sku,
          newStock: productData.stock
        });
      } else {
        allErrors.push(`Product not found: ${productData.name || productData.sku}`);
      }
    } catch (error: any) {
      logger.error('Error updating stock from CSV', error instanceof Error ? error.message : String(error));
      allErrors.push(`Error updating stock for ${productData.name || productData.sku}: ${String(error)}`);
    }
  }

  await client.query('COMMIT');

  // Emit final progress/completion event
  emitProgress(
    uploadId,
    100,
    'Stock update completed!',
    products.length,
    products.length,
    allErrors,
    true,
    `Successfully updated stock for ${updatedProducts.length} products${allErrors.length > 0 ? ` with ${allErrors.length} errors` : ''}`
  );

  return {
    updated: updatedProducts.length,
    errors: allErrors,
    errorDetails: allErrors
  };
}

export async function parseProductCSV(fileBuffer: Buffer): Promise<{
  products: Array<{
    name: string;
    category: string;
    brand: string;
    description: string;
    stock: number;
    reorderLevel: number;
    unitPrice: number;
    sellingPrice: number;
    hsn_code: string | null;
    gst_rate: number;
  }>;
  errors: string[];
}> {
  const products: any[] = [];
  const errors: string[] = [];

  const stream = Readable.from(fileBuffer.toString());

  await new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (row) => {
        try {
          const product = {
            name: row.product_name || row['Product Name'],
            category: row.category || row['Category'],
            brand: row.brand || row['Brand'] || '',
            description: row.description || row['Description'] || '',
            stock: parseInt(row.stock_quantity || row['Stock Quantity']) || 0,
            reorderLevel: parseInt(row.reorder_level || row['Reorder Level']) || 0,
            unitPrice: parseFloat(row.cost_price || row['Cost Price'] || row.unit_price || row['Unit Price']) || 0,
            sellingPrice: parseFloat(row.selling_price || row['Selling Price']) || 0,
            hsn_code: row.hsn_code || row['HSN Code'] || null,
            gst_rate: parseFloat(row.gst_rate || row['GST Rate']) || 18.00
          };

          if (!product.name) {
            errors.push(`Missing required fields in row: ${JSON.stringify(row)}`);
            return;
          }

          products.push(product);
        } catch (error) {
          errors.push(`Error parsing row: ${JSON.stringify(row)} - ${error}`);
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  return { products, errors };
}

export async function processProductCSV(
  client: any,
  userId: string,
  fileBuffer: Buffer,
  uploadId: string
): Promise<{
  created: number;
  errors: number;
  errorDetails: string[];
}> {
  const merchantId = await getUserMerchantId(client, userId);
  if (!merchantId) {
    throw new Error('User not found');
  }

  const { products, errors: parseErrors } = await parseProductCSV(fileBuffer);

  if (products.length === 0) {
    throw new Error('No valid products found in CSV');
  }

  await client.query('BEGIN');

  // Emit initial progress
  const connectedClients = (global as any).io?.sockets?.sockets?.size || 0;
  logger.info('CSV upload progress tracking', { uploadId, connectedClients });
  emitProgress(uploadId, 0, 'Starting upload...', products.length, 0, parseErrors, false);

  const createdProducts: any[] = [];
  const allErrors = [...parseErrors];

  // BATCH PROCESSING: Process products in batches of 500 for efficiency
  const totalBatches = Math.ceil(products.length / BATCH_SIZE);

  logger.info('Starting BATCH PROCESSING', {
    totalProducts: products.length,
    batchSize: BATCH_SIZE,
    totalBatches,
    merchantId
  });

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * BATCH_SIZE;
    const endIndex = Math.min(startIndex + BATCH_SIZE, products.length);
    const batch = products.slice(startIndex, endIndex);

    try {
      logger.info('Processing batch', {
        batchIndex: batchIndex + 1,
        totalBatches,
        batchSize: batch.length,
        startIndex,
        endIndex
      });

      // Emit batch progress update
      emitBatchProgress(
        uploadId,
        Math.round((startIndex / products.length) * 100),
        batchIndex + 1,
        totalBatches,
        batch.length,
        products.length,
        startIndex,
        allErrors
      );

      // Process entire batch in a single transaction
      await client.query('BEGIN');

      // Batch insert products with conflict handling
      const productResults = await batchInsertProducts(client, merchantId, batch);

      // Batch insert inventory records
      const inventoryResults = await batchInsertInventory(
        client,
        merchantId,
        productResults,
        batch
      );

      // Commit batch transaction
      await client.query('COMMIT');

      // Add successful results
      createdProducts.push(...inventoryResults.map((_: any, index: number) => ({
        ...batch[index],
        productId: productResults[index].product_id,
        sku: productResults[index].sku,
        name: productResults[index].product_name
      })));

      logger.info('Batch processed successfully', {
        batchIndex: batchIndex + 1,
        batchSize: batch.length,
        totalProcessed: createdProducts.length
      });

      // Emit batch completion progress
      emitBatchProgress(
        uploadId,
        Math.round((endIndex / products.length) * 100),
        batchIndex + 1,
        totalBatches,
        batch.length,
        products.length,
        endIndex,
        allErrors
      );
    } catch (error: any) {
      // Rollback batch transaction on error
      await client.query('ROLLBACK');

      logger.error('Error processing batch', {
        batchIndex: batchIndex + 1,
        error: error instanceof Error ? error.message : String(error)
      });

      // Add individual items from failed batch to errors
      batch.forEach((product) => {
        allErrors.push(`Error creating product ${product.name}: ${String(error)}`);
      });
    }
  }

  await client.query('COMMIT');

  logger.info('CSV processing completed', {
    totalParsed: products.length,
    created: createdProducts.length,
    errors: allErrors.length
  });

  // Emit final progress/completion event
  emitProgress(
    uploadId,
    100,
    'Upload completed!',
    products.length,
    products.length,
    allErrors,
    true,
    `Successfully processed ${createdProducts.length} products${allErrors.length > 0 ? ` with ${allErrors.length} errors` : ''}`
  );

  return {
    created: createdProducts.length,
    errors: allErrors.length,
    errorDetails: allErrors
  };
}

function emitProgress(
  uploadId: string,
  progress: number,
  currentItem: string,
  totalItems: number,
  processedItems: number,
  errors: string[],
  completed: boolean,
  successMessage?: string
) {
  if ((global as any).io) {
    (global as any).io.emit('csv-upload-progress', {
      uploadId,
      progress,
      currentItem,
      totalItems,
      processedItems,
      errors: [...errors],
      completed,
      ...(successMessage && { successMessage })
    });
  }
}

function emitBatchProgress(
  uploadId: string,
  progress: number,
  currentBatch: number,
  totalBatches: number,
  batchSize: number,
  totalItems: number,
  processedItems: number,
  errors: string[]
) {
  if ((global as any).io) {
    (global as any).io.emit('csv-upload-progress', {
      uploadId,
      progress,
      currentItem: `Processing batch ${currentBatch}/${totalBatches} (${batchSize} items)`,
      totalItems,
      processedItems,
      errors: [...errors],
      completed: false,
      batchProcessing: true,
      currentBatch,
      totalBatches,
      batchSize
    });
  }
}

