import { Router, Request, Response } from 'express';
import { pool } from './db';
import { logger } from './utils/logger';
import multer from 'multer';

// Import extracted queries
import * as invoiceQueries from './invoices/queries/invoice-queries';
import * as invoiceItemQueries from './invoices/queries/invoice-item-queries';

// Import extracted services
import { createInvoiceFromOrder } from './invoices/services/invoiceService';
import { processCSVUpload } from './invoices/services/csvService';
import { generateInvoicePDF } from './invoices/services/pdfService';
import { updateInvoiceDetails, updateInvoiceStatus } from './invoices/services/invoiceUpdateService';

// Declare global io type
declare global {
  var io: any;
}

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// Get all invoices with pagination
router.get('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);
    
    // Get user merchant ID
    const userQuery = invoiceQueries.getUserMerchantIdQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const { merchant_id: merchantId } = userResult.rows[0];
    
    // Get invoices with pagination
    const invoicesQuery = invoiceQueries.getInvoicesQuery(
      merchantId,
      search as string | undefined,
      status as string | undefined,
      limitNum,
      offset
    );
    const result = await client.query(invoicesQuery.query, invoicesQuery.queryParams);
    
    const invoices = result.rows.map(row => ({
      invoice_id: row.invoice_id,
      invoice_number: row.invoice_number,
      invoice_prefix: row.invoice_prefix || 'INV-',
      display_number: `${row.invoice_prefix || 'INV-'}${row.invoice_number}`,
      order_id: row.order_id,
      invoice_date: row.invoice_date,
      due_date: row.due_date,
      subtotal: parseFloat(row.subtotal) || 0,
      tax_amount: parseFloat(row.tax_amount) || 0,
      cgst_amount: parseFloat(row.cgst_amount) || 0,
      sgst_amount: parseFloat(row.sgst_amount) || 0,
      igst_amount: parseFloat(row.igst_amount) || 0,
      discount_amount: parseFloat(row.discount_amount) || 0,
      total_amount: parseFloat(row.total_amount) || 0,
      payment_status: row.payment_status,
      payment_method: row.payment_method,
      pdf_url: row.pdf_url,
      notes: row.notes,
      customer_name: row.customer_name || 'Unknown Customer',
      order_status: row.order_status,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
    
    res.json({ 
      invoices,
      pagination: {
        page: Number(page),
        limit: limitNum,
        total: result.rows[0]?.total_count || 0,
        totalPages: Math.ceil((result.rows[0]?.total_count || 0) / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error fetching invoices', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch invoices' });
  } finally {
    client.release();
  }
});

// Create manual invoice
router.post('/add-manual', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { orderId, dueDate, notes, discountAmount = 0 } = req.body;
    
    if (!orderId || !dueDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Order ID and due date are required' });
    }
    
    // Get user info from session
    const userQuery = invoiceQueries.getUserMerchantIdQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    // Parse order ID - handle both numeric and "ORD123" format
    let numericOrderId;
    if (typeof orderId === 'string' && orderId.startsWith('ORD')) {
      numericOrderId = parseInt(orderId.replace('ORD', ''), 10);
    } else {
      numericOrderId = parseInt(orderId, 10);
    }
    
    if (isNaN(numericOrderId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid order ID format' });
    }
    
    // Create invoice using service (GST calculated automatically)
    const result = await createInvoiceFromOrder(
      client,
      numericOrderId, 
      merchantId, 
      dueDate, 
      notes,
      parseFloat(discountAmount.toString()) || 0
    );
    
    await client.query('COMMIT');
    
    logger.info('Manual invoice created successfully', { 
      invoiceId: result.invoice.invoice_id,
      invoiceNumber: result.invoice.invoice_number,
      displayNumber: result.displayNumber,
      orderId: numericOrderId,
      totalAmount: result.invoice.total_amount
    });
    
    // Emit WebSocket event
    try {
      const io = (global as any).io;
      if (io) {
        io.emit('invoice-created', {
          invoiceId: result.invoice.invoice_id,
          invoiceNumber: result.invoice.invoice_number,
          displayNumber: result.displayNumber,
          orderId: numericOrderId,
          totalAmount: result.invoice.total_amount,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.warn('Could not emit WebSocket event', { error: error instanceof Error ? error.message : String(error) });
    }
    
    res.status(201).json({ 
      message: 'Invoice created successfully',
      invoice: {
        invoice_id: result.invoice.invoice_id,
        invoice_number: result.invoice.invoice_number,
        invoice_prefix: result.invoicePrefix,
        display_number: result.displayNumber,
        order_id: numericOrderId,
        total_amount: result.invoice.total_amount,
        subtotal: result.invoice.subtotal,
        tax_amount: result.invoice.tax_amount,
        discount_amount: result.invoice.discount_amount,
        due_date: result.invoice.due_date,
        payment_status: result.invoice.payment_status
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating manual invoice', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      message: 'Failed to create invoice', 
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    client.release();
  }
});

// CSV upload for invoices
router.post('/upload-csv', upload.single('file'), async (req: Request, res: Response) => {
  logger.info('POST /api/invoices/upload-csv - Request received', { 
    fileName: req.file?.originalname,
    fileSize: req.file?.size,
    userId: (req as any).session?.userId,
    sessionExists: !!(req as any).session
  });
  
  const client = await pool.connect();
  const uploadId = req.body.uploadId || `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    if (!req.file) {
      logger.error('No file uploaded');
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get user info from session
    const userQuery = invoiceQueries.getUserMerchantIdQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      logger.error('User not found for CSV upload', { userId: (req as any).session.userId });
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    logger.info('Processing CSV for merchant', { merchantId });

    await client.query('BEGIN');
    
    // Process CSV upload using service
    const { created, errors } = await processCSVUpload(
      client,
      req.file.buffer,
      merchantId,
      uploadId
    );
    
    await client.query('COMMIT');
    
    logger.info('Invoice CSV processed', { 
      created, 
      errors: errors.length 
    });
    
    res.json({
      message: `Successfully processed ${created} invoices using BATCH PROCESSING`,
      created,
      errors: errors.length,
      errorDetails: errors,
      uploadId: uploadId,
      batchProcessing: true,
      batchSize: 500,
      processingMethod: 'Batch Processing (500 invoices per batch)'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error processing invoice CSV upload', error instanceof Error ? error.message : String(error));
    
    // Emit error progress event
    if ((global as any).io) {
      const errorProgressData = {
        uploadId: uploadId,
        progress: 0,
        totalItems: 0,
        processedItems: 0,
        currentItem: 'Upload failed',
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
      (global as any).io.emit('csv-upload-progress', errorProgressData);
    }
    
    res.status(500).json({ message: 'Failed to process CSV upload', error: error instanceof Error ? error.message : String(error) });
  } finally {
    client.release();
  }
});

// Get invoice details with items
router.get('/:id/items', async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    // Get user info
    const userQuery = invoiceQueries.getUserMerchantIdQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    // Get invoice header
    const invoiceQuery = invoiceItemQueries.getInvoiceWithItemsQuery(parseInt(id), merchantId);
    const invoiceResult = await client.query(invoiceQuery.query, invoiceQuery.queryParams);
    
    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Get invoice items
    const itemsQuery = invoiceItemQueries.getInvoiceItemsQuery(parseInt(id));
    const itemsResult = await client.query(itemsQuery.query, itemsQuery.queryParams);
    
    const invoice = invoiceResult.rows[0];
    
    res.json({
      invoice: {
        invoice_id: invoice.invoice_id,
        invoice_number: invoice.invoice_number,
        invoice_prefix: invoice.invoice_prefix || 'INV-',
        display_number: `${invoice.invoice_prefix || 'INV-'}${invoice.invoice_number}`,
        order_id: invoice.order_id,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        subtotal: parseFloat(invoice.subtotal) || 0,
        tax_amount: parseFloat(invoice.tax_amount) || 0,
        discount_amount: parseFloat(invoice.discount_amount) || 0,
        total_amount: parseFloat(invoice.total_amount) || 0,
        payment_status: invoice.payment_status,
        payment_method: invoice.payment_method,
        pdf_url: invoice.pdf_url,
        notes: invoice.notes,
        customer_name: invoice.customer_name,
        order_status: invoice.order_status,
        created_at: invoice.created_at,
        updated_at: invoice.updated_at
      },
      items: itemsResult.rows.map(item => ({
        invoice_item_id: item.invoice_item_id,
        order_item_id: item.order_item_id,
        product_id: item.product_id,
        inventory_id: item.inventory_id,
        product_name: item.product_name,
        sku: item.sku,
        quantity: parseFloat(item.quantity) || 0,
        unit_price: parseFloat(item.unit_price) || 0,
        total_amount: parseFloat(item.total_amount) || 0,
        created_at: item.created_at,
        updated_at: item.updated_at
      }))
    });
  } catch (error) {
    logger.error('Error fetching invoice details', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch invoice details' });
  } finally {
    client.release();
  }
});

// Update invoice status
router.patch('/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { payment_status, payment_method } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get user info
    const userQuery = invoiceQueries.getUserMerchantIdQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    // Update invoice status using service
    const invoice = await updateInvoiceStatus(
      client,
      parseInt(id),
      merchantId,
      payment_status,
      payment_method
    );
    
    await client.query('COMMIT');
    
    logger.info('Invoice status updated', { 
      invoiceId: invoice.invoice_id,
      paymentStatus: invoice.payment_status,
      paymentMethod: invoice.payment_method
    });
    
    // Emit WebSocket event
    try {
      const io = (global as any).io;
      if (io) {
        io.emit('invoice-status-updated', {
          invoiceId: invoice.invoice_id,
          paymentStatus: invoice.payment_status,
          paymentMethod: invoice.payment_method,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.warn('Could not emit WebSocket event', { error: error instanceof Error ? error.message : String(error) });
    }
    
    res.json({ 
      message: 'Invoice status updated successfully',
      invoice: {
        invoice_id: invoice.invoice_id,
        payment_status: invoice.payment_status,
        payment_method: invoice.payment_method,
        updated_at: invoice.updated_at
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating invoice status', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to update invoice status' });
  } finally {
    client.release();
  }
});

// Update invoice details
router.patch('/:id', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const invoiceId = parseInt(id, 10);
    
    const {
      dueDate,
      notes,
      discountAmount,
      paymentStatus,
      paymentMethod
    } = req.body;
    
    // Get user info from session
    const userQuery = invoiceQueries.getUserMerchantIdQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    // Update invoice using service
    const updatedInvoice = await updateInvoiceDetails(
      client,
      invoiceId,
      merchantId,
      {
        dueDate,
        notes,
        discountAmount,
        paymentStatus,
        paymentMethod
      }
    );
    
    await client.query('COMMIT');
    
    // Emit WebSocket event
    try {
      const io = (global as any).io;
      if (io) {
        io.emit('invoice-updated', {
          invoiceId: invoiceId,
          updatedFields: {
            dueDate,
            notes,
            discountAmount,
            paymentStatus,
            paymentMethod,
            totalAmount: updatedInvoice.total_amount
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (wsError) {
      logger.warn('Could not emit WebSocket event for invoice update', { error: wsError instanceof Error ? wsError.message : String(wsError) });
    }
    
    res.json({
      message: 'Invoice updated successfully',
      invoice: {
        invoice_id: updatedInvoice.invoice_id,
        invoice_number: updatedInvoice.invoice_number,
        due_date: updatedInvoice.due_date,
        notes: updatedInvoice.notes,
        discount_amount: updatedInvoice.discount_amount,
        total_amount: updatedInvoice.total_amount,
        payment_status: updatedInvoice.payment_status,
        payment_method: updatedInvoice.payment_method,
        updated_at: updatedInvoice.updated_at
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating invoice', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to update invoice' });
  } finally {
    client.release();
  }
});

// Download invoice as PDF
router.get('/:id/download', async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    // Get user info
    const userQuery = invoiceQueries.getUserMerchantIdQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    // Generate PDF using service
    await generateInvoicePDF(client, parseInt(id), merchantId, res);
    
  } catch (error) {
    logger.error('Error generating invoice PDF', error instanceof Error ? error.message : String(error));
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to generate invoice PDF' });
    }
  } finally {
    client.release();
  }
});

export default router;
