/**
 * Application constants and enums
 */

// Order statuses
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned'
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  PICKUP: 'pickup'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Payment methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  UPI: 'upi',
  NET_BANKING: 'net_banking',
  WALLET: 'wallet'
} as const;

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];

// Order sources
export const ORDER_SOURCES = {
  POS: 'POS',
  WHATSAPP: 'WhatsApp',
  CSV: 'CSV',
  MANUAL: 'Manual',
  WEBSITE: 'Website'
} as const;

export type OrderSource = typeof ORDER_SOURCES[keyof typeof ORDER_SOURCES];

// File upload constants
export const FILE_UPLOAD = {
  MAX_SIZE: 8 * 1024 * 1024, // 8MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
} as const;

// Database table names
export const TABLES = {
  USERS: 'oms.users',
  MERCHANTS: 'oms.merchants',
  PRODUCTS: 'oms.products',
  INVENTORY: 'oms.inventory',
  ORDERS: 'oms.orders',
  ORDER_ITEMS: 'oms.order_items',
  CUSTOMERS: 'oms.customers'
} as const;

// API response messages
export const MESSAGES = {
  USER_NOT_FOUND: 'User not found',
  UNAUTHORIZED: 'Unauthorized access',
  VALIDATION_FAILED: 'Validation failed',
  INTERNAL_ERROR: 'Internal server error',
  SUCCESS: 'Operation completed successfully',
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  NOT_FOUND: 'Resource not found'
} as const;

// Validation limits
export const VALIDATION_LIMITS = {
  USERNAME_MIN: 3,
  USERNAME_MAX: 50,
  PRODUCT_NAME_MAX: 255,
  SKU_MAX: 100,
  DESCRIPTION_MAX: 1000,
  CATEGORY_MAX: 100,
  PHONE_MAX: 20,
  EMAIL_MAX: 255,
  ADDRESS_MAX: 500
} as const;