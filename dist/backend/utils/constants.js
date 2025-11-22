"use strict";
/**
 * Application constants and enums
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALIDATION_LIMITS = exports.MESSAGES = exports.TABLES = exports.FILE_UPLOAD = exports.ORDER_SOURCES = exports.PAYMENT_METHODS = exports.USER_ROLES = exports.ORDER_STATUS = void 0;
// Order statuses
exports.ORDER_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    RETURNED: 'returned'
};
// User roles
exports.USER_ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    EMPLOYEE: 'employee',
    PICKUP: 'pickup'
};
// Payment methods
exports.PAYMENT_METHODS = {
    CASH: 'cash',
    CARD: 'card',
    UPI: 'upi',
    NET_BANKING: 'net_banking',
    WALLET: 'wallet'
};
// Order sources
exports.ORDER_SOURCES = {
    POS: 'POS',
    WHATSAPP: 'WhatsApp',
    CSV: 'CSV',
    MANUAL: 'Manual',
    WEBSITE: 'Website'
};
// File upload constants
exports.FILE_UPLOAD = {
    MAX_SIZE: 8 * 1024 * 1024, // 8MB
    ALLOWED_TYPES: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
};
// Database table names
exports.TABLES = {
    USERS: 'oms.users',
    MERCHANTS: 'oms.merchants',
    PRODUCTS: 'oms.products',
    INVENTORY: 'oms.inventory',
    ORDERS: 'oms.orders',
    ORDER_ITEMS: 'oms.order_items',
    CUSTOMERS: 'oms.customers'
};
// API response messages
exports.MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    UNAUTHORIZED: 'Unauthorized access',
    VALIDATION_FAILED: 'Validation failed',
    INTERNAL_ERROR: 'Internal server error',
    SUCCESS: 'Operation completed successfully',
    CREATED: 'Resource created successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully',
    NOT_FOUND: 'Resource not found'
};
// Validation limits
exports.VALIDATION_LIMITS = {
    USERNAME_MIN: 3,
    USERNAME_MAX: 50,
    PRODUCT_NAME_MAX: 255,
    SKU_MAX: 100,
    DESCRIPTION_MAX: 1000,
    CATEGORY_MAX: 100,
    PHONE_MAX: 20,
    EMAIL_MAX: 255,
    ADDRESS_MAX: 500
};
//# sourceMappingURL=constants.js.map