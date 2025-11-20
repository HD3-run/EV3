// Order service - Business logic for order operations

import { PoolClient } from 'pg';
import { logger } from '../../utils/logger';
import * as employeeQueries from '../queries/employee-queries';
import * as customerQueries from '../queries/customer-queries';
import * as productQueries from '../queries/product-queries';
import * as orderQueries from '../queries/order-queries';
import * as orderItemQueries from '../queries/order-item-queries';

/**
 * Create manual order with customer and product validation
 */
export async function createManualOrder(
  client: PoolClient,
  userId: number,
  merchantId: number,
  orderData: {
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    addressLine1: string;
    addressLine2: string;
    landmark: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    alternatePhone: string;
    isVerifiedAddress: boolean;
    deliveryNote: string;
    productName: string;
    productId?: string;
    quantity: number;
    unitPrice: number;
    orderSource: string;
    state_code?: string;
    gst_number?: string;
  }
) {
  const calculatedTotalAmount = orderData.quantity * orderData.unitPrice;

  logger.info('Manual order creation - input validation', {
    quantity: orderData.quantity,
    unitPrice: orderData.unitPrice,
    calculatedTotal: calculatedTotalAmount,
    note: 'total_amount will be set to quantity * unitPrice'
  });

  // Create or find customer
  let customerId;
  const findCustomerQuery = customerQueries.findCustomerByPhone(orderData.customerPhone, merchantId);
  const customerResult = await client.query(findCustomerQuery.query, findCustomerQuery.queryParams);
  
  if (customerResult.rows.length > 0) {
    customerId = customerResult.rows[0].customer_id;
    
    // Update existing customer with new address details if provided
    if (orderData.orderSource !== 'Manual' && orderData.addressLine1) {
      const updateQuery = customerQueries.updateCustomerDetails(
        customerId,
        merchantId,
        orderData.customerName,
        orderData.customerEmail,
        orderData.addressLine1,
        orderData.addressLine2,
        orderData.landmark,
        orderData.city,
        orderData.state,
        orderData.pincode,
        orderData.country,
        orderData.alternatePhone,
        orderData.isVerifiedAddress,
        orderData.deliveryNote,
        orderData.state_code || null,
        orderData.gst_number || null
      );
      await client.query(updateQuery.query, updateQuery.queryParams);
    }
  } else {
    // Create new customer
    const createQuery = customerQueries.createCustomer(
      merchantId,
      orderData.customerName,
      orderData.customerPhone,
      orderData.customerEmail,
      orderData.addressLine1,
      orderData.addressLine2,
      orderData.landmark,
      orderData.city,
      orderData.state,
      orderData.pincode,
      orderData.country,
      orderData.alternatePhone,
      orderData.isVerifiedAddress,
      orderData.deliveryNote,
      orderData.state_code || null,
      orderData.gst_number || null
    );
    const newCustomer = await client.query(createQuery.query, createQuery.queryParams);
    customerId = newCustomer.rows[0].customer_id;
  }
  
  // Create order
  const orderResult = await client.query(
    'INSERT INTO oms.orders (merchant_id, customer_id, order_source, total_amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [merchantId, customerId, orderData.orderSource, calculatedTotalAmount, 'pending']
  );
  
  const order = orderResult.rows[0];
  
  // Check if product exists in inventory (by ID or name)
  let inventoryResult;
  if (orderData.productId) {
    const productQuery = productQueries.findProductById(parseInt(orderData.productId), merchantId);
    inventoryResult = await client.query(productQuery.query, productQuery.queryParams);
  } else {
    const productQuery = productQueries.findProductByName(orderData.productName, merchantId);
    inventoryResult = await client.query(productQuery.query, productQuery.queryParams);
  }
  
  if (inventoryResult.rows.length === 0) {
    const identifier = orderData.productId ? `ID ${orderData.productId}` : `"${orderData.productName}"`;
    throw new Error(`Product ${identifier} not found in inventory. Please add it to inventory first.`);
  }
  
  const { product_id: foundProductId, product_name: foundProductName, inventory_id: inventoryId, quantity_available: availableStock } = inventoryResult.rows[0];
  
  if (availableStock < orderData.quantity) {
    throw new Error(`Insufficient stock for "${foundProductName}". Available: ${availableStock}, Required: ${orderData.quantity}`);
  }
  
  // Create order item
  const calculatedTotalPrice = orderData.quantity * orderData.unitPrice;
  const orderItemQuery = orderItemQueries.createOrderItem(
    order.order_id,
    foundProductId,
    inventoryId,
    `SKU-${foundProductId}`,
    orderData.quantity,
    orderData.unitPrice,
    calculatedTotalPrice
  );
  await client.query(orderItemQuery.query, orderItemQuery.queryParams);
  
  // Update inventory
  const inventoryQuery = productQueries.updateInventoryQuantity(foundProductId, merchantId, orderData.quantity);
  await client.query(inventoryQuery.query, inventoryQuery.queryParams);
  
  // Log initial order status to history table
  await client.query(
    'INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)',
    [order.order_id, null, 'pending', userId]
  );
  
  // Get complete order data
  const completeOrderQuery = orderQueries.getCompleteOrderQuery(order.order_id, merchantId);
  const completeOrderResult = await client.query(completeOrderQuery.query, completeOrderQuery.queryParams);
  
  return completeOrderResult.rows[0];
}

/**
 * Update order item prices and recalculate totals
 */
export async function updateOrderPrices(
  client: PoolClient,
  orderId: number,
  merchantId: number,
  pricePerUnit: number
) {
  // Update order items
  const updateItemsQuery = orderItemQueries.updateOrderItemPrices(orderId, pricePerUnit);
  await client.query(updateItemsQuery.query, updateItemsQuery.queryParams);
  
  // Recalculate total
  const totalQuery = orderItemQueries.calculateOrderTotal(orderId);
  const totalResult = await client.query(totalQuery.query, totalQuery.queryParams);
  const newTotalAmount = parseFloat(totalResult.rows[0].new_total);
  
  // Update order total
  const updateOrderQuery = orderItemQueries.updateOrderTotal(orderId, merchantId, newTotalAmount);
  await client.query(updateOrderQuery.query, updateOrderQuery.queryParams);
  
  return newTotalAmount;
}

