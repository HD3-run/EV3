// Order creation service for public orders

import { PoolClient } from 'pg';
import { logger } from '../../utils/logger';
import * as merchantQueries from '../queries/mrcnt-validation-queries';
import * as customerQueries from '../queries/customer-queries';
import * as productInventoryQueries from '../queries/product-inventory-queries';
import * as orderQueries from '../queries/order-queries';
import { updateInventoryAndNotify } from './inventory-service';

export interface PublicOrderItem {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface PublicOrderData {
  merchantId: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  alternatePhone?: string;
  deliveryNote?: string;
  orderSource?: string;
  stateCode?: string;
  gstNumber?: string;
  items: PublicOrderItem[];
}

export interface CreatedOrder {
  order_id: number;
  order_number: string;
  customer_id: number;
  total_amount: number;
  status: string;
  order_items: any[];
}

/**
 * Validate merchant exists
 */
export async function validateMerchant(
  client: PoolClient,
  merchantId: number
): Promise<boolean> {
  const query = merchantQueries.checkMerchantExistsQuery(merchantId);
  const result = await client.query(query.query, query.queryParams);
  return result.rows.length > 0;
}

/**
 * Find or create customer
 */
export async function findOrCreateCustomer(
  client: PoolClient,
  orderData: PublicOrderData
): Promise<number> {
  // Try to find existing customer
  const findQuery = customerQueries.findCustomerByPhoneQuery(
    orderData.customerPhone,
    orderData.merchantId
  );
  const customerResult = await client.query(findQuery.query, findQuery.queryParams);

  if (customerResult.rows.length > 0) {
    const customerId = customerResult.rows[0].customer_id;
    
    // Update customer information if provided
    const updateQuery = customerQueries.updateCustomerQuery(customerId, {
      name: orderData.customerName,
      email: orderData.customerEmail,
      addressLine1: orderData.addressLine1,
      addressLine2: orderData.addressLine2,
      landmark: orderData.landmark,
      city: orderData.city,
      state: orderData.state,
      pincode: orderData.pincode,
      country: orderData.country,
      alternatePhone: orderData.alternatePhone,
      deliveryNote: orderData.deliveryNote,
      stateCode: orderData.stateCode,
      gstNumber: orderData.gstNumber
    });
    await client.query(updateQuery.query, updateQuery.queryParams);
    
    return customerId;
  } else {
    // Create new customer
    const createQuery = customerQueries.createCustomerQuery({
      merchantId: orderData.merchantId,
      name: orderData.customerName,
      phone: orderData.customerPhone,
      email: orderData.customerEmail,
      addressLine1: orderData.addressLine1,
      addressLine2: orderData.addressLine2,
      landmark: orderData.landmark,
      city: orderData.city,
      state: orderData.state,
      pincode: orderData.pincode,
      country: orderData.country,
      alternatePhone: orderData.alternatePhone,
      deliveryNote: orderData.deliveryNote,
      stateCode: orderData.stateCode,
      gstNumber: orderData.gstNumber
    });
    const newCustomer = await client.query(createQuery.query, createQuery.queryParams);
    return newCustomer.rows[0].customer_id;
  }
}

/**
 * Calculate total order amount
 */
export function calculateTotalAmount(items: PublicOrderItem[]): number {
  return items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);
}

/**
 * Process order items and update inventory
 */
export async function processOrderItems(
  client: PoolClient,
  orderId: number,
  items: PublicOrderItem[],
  merchantId: number
): Promise<any[]> {
  const orderItems: any[] = [];

  for (const item of items) {
    // Get product and inventory details
    const productQuery = productInventoryQueries.getProductInventoryQuery(
      item.productId,
      merchantId
    );
    const productResult = await client.query(productQuery.query, productQuery.queryParams);

    if (productResult.rows.length === 0) {
      throw new Error(`Product ${item.productId} not found or doesn't belong to this merchant`);
    }

    const product = productResult.rows[0];

    // Check stock availability
    if (product.quantity_available < item.quantity) {
      throw new Error(
        `Insufficient stock for ${product.product_name}. Available: ${product.quantity_available}, Requested: ${item.quantity}`
      );
    }

    // Insert order item
    const itemTotalPrice = item.quantity * item.unitPrice;
    const orderItemQuery = orderQueries.createOrderItemQuery({
      orderId: orderId,
      productId: product.product_id,
      inventoryId: product.inventory_id,
      sku: product.sku,
      quantity: item.quantity,
      pricePerUnit: item.unitPrice,
      totalPrice: itemTotalPrice
    });
    const orderItemResult = await client.query(orderItemQuery.query, orderItemQuery.queryParams);
    orderItems.push(orderItemResult.rows[0]);

    // Update inventory and emit WebSocket notification
    await updateInventoryAndNotify(
      client,
      product.product_id,
      item.quantity,
      merchantId,
      product.product_name,
      product.sku
    );
  }

  return orderItems;
}

/**
 * Create public order (main service function)
 */
export async function createPublicOrder(
  client: PoolClient,
  orderData: PublicOrderData
): Promise<CreatedOrder> {
  // Validate merchant
  const merchantExists = await validateMerchant(client, orderData.merchantId);
  if (!merchantExists) {
    throw new Error('Merchant not found');
  }

  // Calculate total amount
  const calculatedTotalAmount = calculateTotalAmount(orderData.items);

  logger.info('Public order creation - total calculation', {
    itemsCount: orderData.items.length,
    items: orderData.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      itemTotal: item.quantity * item.unitPrice
    })),
    calculatedTotalAmount
  });

  // Find or create customer
  const customerId = await findOrCreateCustomer(client, orderData);

  // Create order
  const orderQuery = orderQueries.createOrderQuery(
    orderData.merchantId,
    customerId,
    orderData.orderSource || 'catalog',
    calculatedTotalAmount
  );
  const orderResult = await client.query(orderQuery.query, orderQuery.queryParams);
  const order = orderResult.rows[0];

  logger.info('Public order created in database', {
    orderId: order.order_id,
    orderTotalAmount: order.total_amount,
    expectedTotalAmount: calculatedTotalAmount
  });

  // Process order items and update inventory
  const orderItems = await processOrderItems(
    client,
    order.order_id,
    orderData.items,
    orderData.merchantId
  );

  // Log initial order status to history
  const statusHistoryQuery = orderQueries.logOrderStatusHistoryQuery(order.order_id);
  await client.query(statusHistoryQuery.query, statusHistoryQuery.queryParams);

  return {
    order_id: order.order_id,
    order_number: `ORD${order.order_id}`,
    customer_id: customerId,
    total_amount: order.total_amount,
    status: order.status,
    order_items: orderItems
  };
}

