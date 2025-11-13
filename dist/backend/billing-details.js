"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("./db");
const logger_1 = require("./utils/logger");
const validation_1 = require("./middleware/validation");
const router = (0, express_1.Router)();
// Get merchant billing details
router.get('/', async (req, res) => {
    console.log('🔍 GET /api/billing-details - Request received');
    console.log('👤 Session userId:', (0, validation_1.sanitizeForLog)(req.session?.userId));
    console.log('🔐 Session exists:', !!req.session);
    const client = await db_1.pool.connect();
    try {
        // Get user info from session
        console.log('🔍 Looking up user in database...');
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        console.log('👤 User lookup result:', {
            rowsFound: userResult.rows.length,
            userId: req.session.userId,
            merchantId: userResult.rows[0]?.merchant_id
        });
        if (userResult.rows.length === 0) {
            console.log('❌ User not found in database');
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        console.log('✅ Merchant ID found:', merchantId);
        // Get billing details
        console.log('🔍 Fetching billing details from database...');
        const result = await client.query('SELECT * FROM oms.merchant_billing_details WHERE merchant_id = $1', [merchantId]);
        console.log('📊 Billing details query result:', {
            merchantId,
            rowsFound: result.rows.length,
            billingId: result.rows[0]?.billing_id
        });
        if (result.rows.length === 0) {
            console.log('📭 No billing details found, returning null');
            return res.json({ billingDetails: null });
        }
        const billingDetails = result.rows[0];
        const responseData = {
            billingDetails: {
                billing_id: billingDetails.billing_id,
                merchant_id: billingDetails.merchant_id,
                gst_number: billingDetails.gst_number || '',
                pan_number: billingDetails.pan_number || '',
                billing_address_line1: billingDetails.billing_address_line1 || '',
                billing_address_line2: billingDetails.billing_address_line2 || '',
                billing_city: billingDetails.billing_city || '',
                billing_state: billingDetails.billing_state || '',
                billing_pincode: billingDetails.billing_pincode || '',
                billing_country: billingDetails.billing_country || 'India',
                bank_name: billingDetails.bank_name || '',
                bank_account_number: billingDetails.bank_account_number || '',
                ifsc_code: billingDetails.ifsc_code || '',
                invoice_logo_url: billingDetails.invoice_logo_url || '',
                invoice_prefix: billingDetails.invoice_prefix || 'INV-',
                next_invoice_number: billingDetails.next_invoice_number || 1000000000,
                state_code: billingDetails.state_code || '19',
                created_at: billingDetails.created_at,
                updated_at: billingDetails.updated_at
            }
        };
        console.log('🎉 Success! Billing details retrieved successfully');
        res.json(responseData);
    }
    catch (error) {
        console.log('❌ Error occurred:', error);
        logger_1.logger.error('Error fetching billing details', (0, validation_1.sanitizeForLog)(error instanceof Error ? error.message : String(error)));
        res.status(500).json({ message: 'Failed to fetch billing details' });
    }
    finally {
        console.log('🔓 Releasing database connection...');
        client.release();
    }
});
// Create or update merchant billing details
router.post('/', async (req, res) => {
    console.log('🔍 POST /api/billing-details - Request received');
    console.log('📋 Request received for billing details update');
    console.log('👤 Session userId:', (0, validation_1.sanitizeForLog)(req.session?.userId));
    console.log('🔐 Session exists:', !!req.session);
    const client = await db_1.pool.connect();
    try {
        const { gst_number, pan_number, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_pincode, billing_country, bank_name, bank_account_number, ifsc_code, invoice_logo_url, invoice_prefix, state_code } = req.body;
        console.log('📊 Processing billing details update with provided fields');
        // Get user info from session
        console.log('🔍 Looking up user in database...');
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        console.log('👤 User lookup result:', {
            rowsFound: userResult.rows.length,
            userId: req.session.userId,
            merchantId: userResult.rows[0]?.merchant_id
        });
        if (userResult.rows.length === 0) {
            console.log('❌ User not found in database');
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        console.log('✅ Merchant ID found:', merchantId);
        // Validate required fields
        console.log('🔍 Validating required fields...');
        if (!billing_address_line1 || !billing_city || !billing_state || !billing_pincode) {
            console.log('❌ Required fields validation failed:', {
                billing_address_line1: !!billing_address_line1,
                billing_city: !!billing_city,
                billing_state: !!billing_state,
                billing_pincode: !!billing_pincode
            });
            return res.status(400).json({
                message: 'Billing address line 1, city, state, and pincode are required'
            });
        }
        console.log('✅ Required fields validation passed');
        // Validate GST number format (if provided)
        console.log('🔍 Validating GST number...');
        if (gst_number && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst_number)) {
            console.log('❌ GST number validation failed');
            return res.status(400).json({
                message: 'Invalid GST number format. Please enter a valid 15-character GST number.'
            });
        }
        console.log('✅ GST number validation passed');
        // Validate PAN number format (if provided)
        console.log('🔍 Validating PAN number...');
        if (pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan_number)) {
            console.log('❌ PAN number validation failed');
            return res.status(400).json({
                message: 'Invalid PAN number format. Please enter a valid 10-character PAN number.'
            });
        }
        console.log('✅ PAN number validation passed');
        // Validate IFSC code format (if provided)
        console.log('🔍 Validating IFSC code...');
        if (ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code)) {
            console.log('❌ IFSC code validation failed');
            return res.status(400).json({
                message: 'Invalid IFSC code format. Please enter a valid 11-character IFSC code.'
            });
        }
        console.log('✅ IFSC code validation passed');
        console.log('🔄 Starting database transaction...');
        await client.query('BEGIN');
        // Check if billing details already exist
        console.log('🔍 Checking if billing details already exist...');
        const existingResult = await client.query('SELECT billing_id FROM oms.merchant_billing_details WHERE merchant_id = $1', [merchantId]);
        console.log('📊 Existing billing details check:', {
            merchantId,
            existingRecords: existingResult.rows.length,
            existingBillingId: existingResult.rows[0]?.billing_id
        });
        let billingDetails;
        if (existingResult.rows.length > 0) {
            console.log('📝 Updating existing billing details...');
            // Update existing billing details
            console.log('🔄 Executing UPDATE query...');
            const updateResult = await client.query(`UPDATE oms.merchant_billing_details SET
         gst_number = $1,
         pan_number = $2,
         billing_address_line1 = $3,
         billing_address_line2 = $4,
         billing_city = $5,
         billing_state = $6,
         billing_pincode = $7,
         billing_country = $8,
         bank_name = $9,
         bank_account_number = $10,
         ifsc_code = $11,
         invoice_logo_url = $12,
         invoice_prefix = $13,
         state_code = $14,
         updated_at = CURRENT_TIMESTAMP
         WHERE merchant_id = $15
         RETURNING *`, [
                gst_number || null,
                pan_number || null,
                billing_address_line1,
                billing_address_line2 || null,
                billing_city,
                billing_state,
                billing_pincode,
                billing_country || 'India',
                bank_name || null,
                bank_account_number || null,
                ifsc_code || null,
                invoice_logo_url || null,
                invoice_prefix || 'INV-',
                state_code || '19',
                merchantId
            ]);
            console.log('✅ UPDATE query executed successfully:', {
                rowsAffected: updateResult.rows.length,
                billingId: updateResult.rows[0]?.billing_id
            });
            billingDetails = updateResult.rows[0];
            logger_1.logger.info('Billing details updated', { merchantId, billingId: billingDetails.billing_id });
        }
        else {
            console.log('📝 Creating new billing details...');
            // Create new billing details
            console.log('🔄 Executing INSERT query...');
            const insertResult = await client.query(`INSERT INTO oms.merchant_billing_details 
         (merchant_id, gst_number, pan_number, billing_address_line1, billing_address_line2,
          billing_city, billing_state, billing_pincode, billing_country, bank_name,
          bank_account_number, ifsc_code, invoice_logo_url, invoice_prefix, next_invoice_number, state_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`, [
                merchantId,
                gst_number || null,
                pan_number || null,
                billing_address_line1,
                billing_address_line2 || null,
                billing_city,
                billing_state,
                billing_pincode,
                billing_country || 'India',
                bank_name || null,
                bank_account_number || null,
                ifsc_code || null,
                invoice_logo_url || null,
                invoice_prefix || 'INV-',
                1000000000, // Default starting invoice number
                state_code || '19'
            ]);
            console.log('✅ INSERT query executed successfully:', {
                rowsAffected: insertResult.rows.length,
                billingId: insertResult.rows[0]?.billing_id
            });
            billingDetails = insertResult.rows[0];
            logger_1.logger.info('Billing details created', { merchantId, billingId: billingDetails.billing_id });
        }
        console.log('✅ Committing transaction...');
        await client.query('COMMIT');
        const responseData = {
            message: existingResult.rows.length > 0 ? 'Billing details updated successfully' : 'Billing details created successfully',
            billingDetails: {
                billing_id: billingDetails.billing_id,
                merchant_id: billingDetails.merchant_id,
                gst_number: billingDetails.gst_number || '',
                pan_number: billingDetails.pan_number || '',
                billing_address_line1: billingDetails.billing_address_line1,
                billing_address_line2: billingDetails.billing_address_line2 || '',
                billing_city: billingDetails.billing_city,
                billing_state: billingDetails.billing_state,
                billing_pincode: billingDetails.billing_pincode,
                billing_country: billingDetails.billing_country,
                bank_name: billingDetails.bank_name || '',
                bank_account_number: billingDetails.bank_account_number || '',
                ifsc_code: billingDetails.ifsc_code || '',
                invoice_logo_url: billingDetails.invoice_logo_url || '',
                invoice_prefix: billingDetails.invoice_prefix,
                next_invoice_number: billingDetails.next_invoice_number,
                state_code: billingDetails.state_code || '19',
                created_at: billingDetails.created_at,
                updated_at: billingDetails.updated_at
            }
        };
        console.log('🎉 Success! Sending response:', JSON.stringify(responseData, null, 2));
        res.json(responseData);
    }
    catch (error) {
        console.log('❌ Error occurred:', error);
        console.log('🔄 Rolling back transaction...');
        await client.query('ROLLBACK');
        logger_1.logger.error('Error saving billing details', error instanceof Error ? error.message : String(error));
        console.log('📤 Sending error response...');
        res.status(500).json({ message: 'Failed to save billing details' });
    }
    finally {
        console.log('🔓 Releasing database connection...');
        client.release();
    }
});
exports.default = router;
//# sourceMappingURL=billing-details.js.map