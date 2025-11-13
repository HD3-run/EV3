"use strict";
/**
 * SKU generation utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUniqueSku = generateUniqueSku;
exports.validateSkuFormat = validateSkuFormat;
exports.isSkuUnique = isSkuUnique;
const db_1 = require("../db");
const logger_1 = require("./logger");
/**
 * Generate a unique SKU for a merchant
 * Format: SKU-YYYYMMDD-HHMMSS-XXXXX
 * Where XXXXX is a random alphanumeric string
 */
async function generateUniqueSku(merchantId, maxRetries = 5) {
    const client = await db_1.pool.connect();
    try {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
            const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
            const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase(); // 5 chars
            const sku = `SKU-${dateStr}-${timeStr}-${randomStr}`;
            // Check if SKU already exists for this merchant
            const existingResult = await client.query('SELECT product_id FROM oms.products WHERE merchant_id = $1 AND sku = $2', [merchantId, sku]);
            if (existingResult.rows.length === 0) {
                logger_1.logger.info('Generated unique SKU', { sku, merchantId, attempt: attempt + 1 });
                return sku;
            }
            logger_1.logger.warn('SKU collision detected, retrying', { sku, merchantId, attempt: attempt + 1 });
            // Add small delay to avoid rapid collisions
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        // Fallback to UUID-based SKU if all attempts fail
        const fallbackSku = `SKU-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        logger_1.logger.warn('Using fallback SKU generation', { fallbackSku, merchantId });
        return fallbackSku;
    }
    finally {
        client.release();
    }
}
/**
 * Validate SKU format
 */
function validateSkuFormat(sku) {
    // Allow flexible SKU formats but ensure basic structure
    const skuRegex = /^[A-Z0-9][A-Z0-9\-_]{2,99}$/i;
    return skuRegex.test(sku);
}
/**
 * Check if SKU is unique within merchant
 */
async function isSkuUnique(merchantId, sku, excludeProductId) {
    const client = await db_1.pool.connect();
    try {
        let query = 'SELECT product_id FROM oms.products WHERE merchant_id = $1 AND sku = $2';
        const params = [merchantId, sku];
        if (excludeProductId) {
            query += ' AND product_id != $3';
            params.push(excludeProductId);
        }
        const result = await client.query(query, params);
        return result.rows.length === 0;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=sku.js.map