// CSV processing service for invoices

import { PoolClient } from 'pg';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { logger } from '../../utils/logger';
import { createInvoiceFromOrder } from './invoiceService';

export interface CSVInvoiceRow {
  orderId: number;
  dueDate: string;
  notes: string;
  discountAmount: number;
}

const BATCH_SIZE = 500;

/**
 * Parse CSV file into invoice rows
 */
export async function parseCSVInvoices(fileBuffer: Buffer): Promise<{ invoices: CSVInvoiceRow[]; errors: string[] }> {
  const invoices: CSVInvoiceRow[] = [];
  const errors: string[] = [];

  const stream = Readable.from(fileBuffer.toString());
  
  await new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (row) => {
        try {
          const invoice: CSVInvoiceRow = {
            orderId: parseInt(row.order_id || row['Order ID']) || 0,
            dueDate: row.due_date || row['Due Date'],
            notes: row.notes || row['Notes'] || '',
            discountAmount: parseFloat(row.discount_amount || row['Discount Amount']) || 0
          };
          
          if (!invoice.orderId || !invoice.dueDate) {
            errors.push(`Missing required fields in row: ${JSON.stringify(row)}`);
            return;
          }
          
          invoices.push(invoice);
        } catch (error) {
          errors.push(`Error parsing row: ${JSON.stringify(row)} - ${error}`);
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  return { invoices, errors };
}

/**
 * Emit WebSocket progress event
 */
export function emitProgress(
  uploadId: string,
  progress: number,
  totalItems: number,
  processedItems: number,
  currentItem: string,
  errors: string[] = [],
  status: 'processing' | 'completed' | 'error' = 'processing',
  additionalData?: any
): void {
  if ((global as any).io) {
    const progressData = {
      uploadId,
      progress,
      totalItems,
      processedItems,
      currentItem,
      errors: [...errors],
      status,
      ...additionalData
    };
    (global as any).io.emit('csv-upload-progress', progressData);
  }
}

/**
 * Process CSV upload with batch processing
 */
export async function processCSVUpload(
  client: PoolClient,
  fileBuffer: Buffer,
  merchantId: number,
  uploadId: string
): Promise<{ created: number; errors: string[] }> {
  // Parse CSV
  const { invoices, errors: parseErrors } = await parseCSVInvoices(fileBuffer);
  const errors = [...parseErrors];

  if (invoices.length === 0) {
    return { created: 0, errors };
  }

  // Emit initial progress
  emitProgress(uploadId, 0, invoices.length, 0, 'Starting invoice processing...', errors);

  const totalBatches = Math.ceil(invoices.length / BATCH_SIZE);
  const createdInvoices: any[] = [];

  logger.info('Starting BATCH PROCESSING for invoices', { 
    totalInvoices: invoices.length, 
    batchSize: BATCH_SIZE,
    totalBatches,
    merchantId 
  });

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * BATCH_SIZE;
    const endIndex = Math.min(startIndex + BATCH_SIZE, invoices.length);
    const batch = invoices.slice(startIndex, endIndex);
    
    try {
      logger.info('Processing invoices batch', { 
        batchIndex: batchIndex + 1, 
        totalBatches, 
        batchSize: batch.length,
        startIndex,
        endIndex 
      });

      // Emit batch progress update
      emitProgress(
        uploadId,
        Math.round((startIndex / invoices.length) * 100),
        invoices.length,
        startIndex,
        `Processing invoices batch ${batchIndex + 1}/${totalBatches} (${batch.length} invoices)`,
        errors,
        'processing',
        {
          batchProcessing: true,
          currentBatch: batchIndex + 1,
          totalBatches,
          batchSize: batch.length
        }
      );

      // Process entire batch in a single transaction
      await client.query('BEGIN');
      
      const batchResults: any[] = [];
      
      for (const invoiceData of batch) {
        try {
          logger.info('Processing invoice data in batch', { orderId: invoiceData.orderId, dueDate: invoiceData.dueDate });
          
          // Create invoice using service (GST calculated automatically)
          const result = await createInvoiceFromOrder(
            client,
            invoiceData.orderId,
            merchantId,
            invoiceData.dueDate,
            invoiceData.notes || '',
            parseFloat(invoiceData.discountAmount.toString()) || 0
          );
          
          logger.info('Created invoice', { 
            invoiceId: result.invoice.invoice_id, 
            invoiceNumber: result.invoice.invoice_number,
            displayNumber: result.displayNumber,
            orderId: invoiceData.orderId 
          });
          batchResults.push(result.invoice);
        } catch (error: any) {
          errors.push(`Error creating invoice for order ${invoiceData.orderId}: ${String(error)}`);
        }
      }
      
      // Commit batch transaction
      await client.query('COMMIT');
      
      // Add successful results
      createdInvoices.push(...batchResults);
      
      logger.info('Invoices batch processed successfully', { 
        batchIndex: batchIndex + 1, 
        batchSize: batch.length,
        totalProcessed: createdInvoices.length 
      });

      // Emit batch completion progress
      emitProgress(
        uploadId,
        Math.round((endIndex / invoices.length) * 100),
        invoices.length,
        endIndex,
        `Completed invoices batch ${batchIndex + 1}/${totalBatches}`,
        errors,
        'processing',
        {
          batchProcessing: true,
          currentBatch: batchIndex + 1,
          totalBatches,
          batchSize: batch.length
        }
      );

    } catch (error: any) {
      // Rollback batch transaction on error
      await client.query('ROLLBACK');
      
      console.error('Error processing invoices batch:', error);
      logger.error('Error processing invoices batch', { 
        batchIndex: batchIndex + 1, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // Add individual items from failed batch to errors
      batch.forEach((invoiceData) => {
        errors.push(`Error creating invoice for order ${invoiceData.orderId}: ${String(error)}`);
      });
    }
  }

  // Emit final progress event
  emitProgress(
    uploadId,
    100,
    invoices.length,
    invoices.length,
    `Completed! Created ${createdInvoices.length} invoices`,
    errors,
    'completed',
    {
      created: createdInvoices.length,
      errors: errors.length
    }
  );

  logger.info('Invoice CSV processed', { 
    totalRows: invoices.length, 
    created: createdInvoices.length, 
    errors: errors.length 
  });

  return {
    created: createdInvoices.length,
    errors
  };
}

