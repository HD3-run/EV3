"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const express_1 = require("express");
const user_model_1 = require("./user.model");
const logger_1 = require("./utils/logger");
const db_1 = require("./db");
const jwt_1 = require("./utils/jwt");
const orders_1 = __importDefault(require("./orders"));
const inventory_1 = __importDefault(require("./inventory"));
const reports_1 = __importDefault(require("./reports"));
const invoices_1 = __importDefault(require("./invoices"));
const billing_details_1 = __importDefault(require("./billing-details"));
const returns_1 = __importDefault(require("./returns"));
const product_catalog_1 = __importDefault(require("./product-catalog"));
const public_catalog_1 = __importDefault(require("./public-catalog"));
const public_orders_1 = __importDefault(require("./public-orders"));
const employee_1 = __importDefault(require("./employee"));
const auth_1 = require("./middleware/auth");
const validation_1 = require("./middleware/validation");
const pool_protection_1 = require("./middleware/pool-protection");
const router = (0, express_1.Router)();
// Phone number validation for Indian phone numbers
const validatePhoneNumber = (phone) => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    // Indian phone number patterns:
    // 10 digits: 9876543210
    // 11 digits with country code: 919876543210
    // 12 digits with +91: +919876543210
    // 13 digits with country code: 919876543210 (with extra digit)
    const phoneRegex = /^(?:\+?91)?[6-9]\d{9}$/;
    return phoneRegex.test(digitsOnly) && digitsOnly.length >= 10 && digitsOnly.length <= 13;
};
// Register route
router.post('/register', validation_1.validatePassword, async (req, res) => {
    const { username, email, password, phoneNumber, businessName } = req.body;
    if (!username || !email || !password || !phoneNumber || !businessName) {
        return res.status(400).json({ message: 'All fields are required: username, email, password, phone number, and business name' });
    }
    // Validate phone number format
    if (!validatePhoneNumber(phoneNumber)) {
        return res.status(400).json({ message: 'Please enter a valid Indian phone number (10-digits)' });
    }
    try {
        const existingUser = await (0, user_model_1.findUserByEmail)(email);
        if (existingUser) {
            logger_1.logger.warn('Registration attempt for existing user', { email: email.substring(0, 3) + '***' });
            return res.status(409).json({ message: 'User with that email already exists' });
        }
        const newUser = await (0, user_model_1.createUser)(username, email, password, phoneNumber, businessName);
        if (newUser) {
            logger_1.logger.info('User registered successfully', { userId: newUser.user_id });
            req.session.userId = newUser.user_id;
            // Create phantom token pair for enhanced security
            const { phantomToken } = (0, jwt_1.createPhantomTokenPair)({
                userId: newUser.user_id,
                role: newUser.role,
                merchant_id: newUser.merchant_id
            });
            return res.status(201).json({
                message: 'User registered successfully',
                userId: newUser.user_id,
                username: newUser.username,
                role: newUser.role,
                token: phantomToken
            });
        }
        else {
            return res.status(500).json({ message: 'Failed to register user' });
        }
    }
    catch (error) {
        logger_1.logger.error('Registration error', error instanceof Error ? error.message : String(error));
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// Login route
router.post('/login', async (req, res) => {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
        return res.status(400).json({ message: 'Email/phone and password are required' });
    }
    try {
        const user = await (0, user_model_1.findUserByEmailOrPhone)(emailOrPhone);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isPasswordValid = await (0, user_model_1.verifyPassword)(password, user.password_hash);
        if (!isPasswordValid) {
            logger_1.logger.warn('Failed login attempt - invalid password', { emailOrPhone: emailOrPhone.substring(0, 3) + '***' });
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        logger_1.logger.info('User logged in successfully', { userId: user.user_id });
        req.session.userId = user.user_id;
        // Create phantom token pair for enhanced security
        const { phantomToken } = (0, jwt_1.createPhantomTokenPair)({
            userId: user.user_id,
            role: user.role,
            merchant_id: user.merchant_id
        });
        return res.status(200).json({
            message: 'Logged in successfully',
            userId: user.user_id,
            username: user.username,
            role: user.role,
            token: phantomToken // Send phantom token to client
        });
    }
    catch (error) {
        logger_1.logger.error('Login error', error instanceof Error ? error.message : String(error));
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// Validate session route
router.get('/validate-session', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(200).json({ valid: false, message: 'No active session' });
        }
        // Get user data from database
        const user = await (0, user_model_1.findUserById)(req.session.userId.toString());
        if (!user) {
            // User not found, clear session
            req.session.destroy((err) => {
                if (err)
                    logger_1.logger.error('Session destruction error during validation', err);
            });
            return res.status(200).json({ valid: false, message: 'User not found' });
        }
        // Return user data for frontend
        return res.status(200).json({
            valid: true,
            user: {
                username: user.username,
                role: user.role
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Session validation error', error instanceof Error ? error.message : String(error));
        return res.status(500).json({ valid: false, message: 'Session validation failed' });
    }
});
// Logout route
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            logger_1.logger.error('Logout error', err instanceof Error ? err.message : String(err));
            return res.status(500).json({ message: 'Failed to log out' });
        }
        res.clearCookie('connect.sid'); // Clear session cookie
        res.status(200).json({ message: 'Logged out successfully' });
    });
});
// Get user info route (including creation date)
router.get('/user-info', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    try {
        const user = await (0, user_model_1.findUserById)(req.session.userId.toString());
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.json({
            user_id: user.user_id,
            username: user.username,
            email: user.email,
            role: user.role,
            created_at: user.created_at,
            merchant_id: user.merchant_id
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching user info', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Internal server error' });
    }
});
// Protected route example
router.get('/protected', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    res.status(200).json({ message: 'You have access to protected data!', userId: req.session.userId });
});
function registerRoutes(app) {
    // Authentication middleware
    // Removed requireAuth as authenticateUser handles authentication and populates req.user
    // Add session debugging middleware for development
    if (process.env.NODE_ENV === 'development') {
        app.use('/api', (req, _res, next) => {
            logger_1.logger.info('API Request Debug', {
                path: req.path,
                method: req.method,
                sessionId: req.sessionID,
                userId: req.session?.userId,
                userIdType: typeof req.session?.userId,
                hasSession: !!req.session,
                cookies: req.headers.cookie ? 'present' : 'none'
            });
            next();
        });
    }
    // Register route modules
    app.use('/api/auth', router);
    app.get('/api/merchant-info', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: 'Not authenticated' });
            }
            const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }
            const merchantId = userResult.rows[0].merchant_id;
            const merchantResult = await client.query('SELECT merchant_id, merchant_name FROM oms.merchants WHERE merchant_id = $1', [merchantId]);
            if (merchantResult.rows.length === 0) {
                return res.status(404).json({ message: 'Merchant not found' });
            }
            res.json({
                merchant_id: merchantResult.rows[0].merchant_id,
                business_name: merchantResult.rows[0].merchant_name, // Map merchant_name to business_name for frontend
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching merchant info', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to fetch merchant info' });
        }
        finally {
            client.release();
        }
    });
    app.use('/api/orders', auth_1.authenticateUser, orders_1.default);
    app.use('/api/inventory', auth_1.authenticateUser, inventory_1.default);
    app.use('/api/reports', auth_1.authenticateUser, reports_1.default);
    app.use('/api/invoices', auth_1.authenticateUser, invoices_1.default);
    app.use('/api/billing-details', auth_1.authenticateUser, billing_details_1.default);
    app.use('/api/returns', auth_1.authenticateUser, returns_1.default);
    app.use('/api/catalog', auth_1.authenticateUser, product_catalog_1.default); // Product catalog routes - requires authentication
    app.use('/api/public/catalog', public_catalog_1.default); // Public catalog routes - no authentication required
    app.use('/api/public/orders', public_orders_1.default); // Public order creation - no authentication required
    app.use('/api/employee', auth_1.authenticateUser, employee_1.default); // Employee routes - requires authentication
    // Add debug endpoints for development
    if (process.env.NODE_ENV === 'development') {
        // Pool status monitoring endpoint
        app.get('/api/debug/pool-status', async (req, res) => {
            try {
                const status = (0, pool_protection_1.getPoolStatus)();
                res.json(status);
            }
            catch (error) {
                logger_1.logger.error('Error fetching pool status', error instanceof Error ? error.message : String(error));
                res.status(500).json({ message: 'Failed to fetch pool status' });
            }
        });
        app.get('/api/debug/verify-user-data', async (req, res) => {
            const client = await db_1.pool.connect();
            try {
                // Check for specific user 'mya' and their assignments
                const mayaUser = await client.query('SELECT user_id, merchant_id, username, role FROM oms.users WHERE username = $1', ['mya']);
                if (mayaUser.rows.length === 0) {
                    return res.json({ message: 'User mya not found', sessionUserId: req.session?.userId });
                }
                const mayaId = mayaUser.rows[0].user_id;
                // Get mya's assigned orders
                const mayaOrders = await client.query('SELECT o.order_id, o.order_source, o.total_amount, o.status, o.created_at, c.name as customer_name FROM oms.orders o LEFT JOIN oms.customers c ON o.customer_id = c.customer_id WHERE o.user_id = $1', [mayaId]);
                // Check current session user
                const currentUserId = req.session?.userId;
                const isCurrentUserMaya = currentUserId && (parseInt(currentUserId) === mayaId || currentUserId === mayaId.toString());
                res.json({
                    mayaUser: mayaUser.rows[0],
                    mayaOrders: mayaOrders.rows,
                    currentSessionUserId: currentUserId,
                    currentUserIdType: typeof currentUserId,
                    isCurrentUserMaya,
                    sessionExists: !!req.session,
                    sessionId: req.sessionID
                });
            }
            catch (error) {
                logger_1.logger.error('Error verifying user data', error instanceof Error ? error.message : String(error));
                res.status(500).json({ message: 'Failed to verify user data' });
            }
            finally {
                client.release();
            }
        });
    }
    // Profile management endpoints
    app.get('/api/profile', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            const result = await client.query('SELECT username, email, phone_number FROM oms.users WHERE user_id = $1', [req.session.userId]);
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }
            const user = result.rows[0];
            res.json({
                username: user.username,
                email: user.email,
                phone: user.phone_number || ''
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching profile', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to fetch profile' });
        }
        finally {
            client.release();
        }
    });
    app.put('/api/profile', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            const { name, email, phone } = req.body;
            await client.query('BEGIN');
            // Update user profile
            const userResult = await client.query('UPDATE oms.users SET username = $1, email = $2, phone_number = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4 RETURNING username, email, phone_number, merchant_id', [name, email, phone, req.session.userId]);
            if (userResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'User not found' });
            }
            const user = userResult.rows[0];
            // Also update merchant information
            await client.query('UPDATE oms.merchants SET contact_person_name = $1, email = $2, phone_number = $3, updated_at = CURRENT_TIMESTAMP WHERE merchant_id = $4', [name, email, phone, user.merchant_id]);
            await client.query('COMMIT');
            logger_1.logger.info('Profile and merchant updated successfully', { userId: req.session.userId, merchantId: user.merchant_id });
            res.json({
                message: 'Profile updated successfully',
                user: {
                    username: user.username,
                    email: user.email,
                    phone_number: user.phone_number
                }
            });
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger_1.logger.error('Error updating profile', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to update profile' });
        }
        finally {
            client.release();
        }
    });
    app.put('/api/profile/password', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            const { currentPassword, newPassword } = req.body;
            // Validate password complexity
            const errors = [];
            if (newPassword.length < 8)
                errors.push('Password must be at least 8 characters');
            if (!/[A-Z]/.test(newPassword))
                errors.push('Password must contain uppercase letter');
            if (!/[a-z]/.test(newPassword))
                errors.push('Password must contain lowercase letter');
            if (!/\d/.test(newPassword))
                errors.push('Password must contain number');
            if (!/[!@#$%^&*]/.test(newPassword))
                errors.push('Password must contain special character');
            if (errors.length > 0) {
                return res.status(400).json({ message: 'Password requirements not met', errors });
            }
            // Get current user data
            const userResult = await client.query('SELECT password_hash FROM oms.users WHERE user_id = $1', [req.session.userId]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }
            const user = userResult.rows[0];
            // Verify current password
            const isCurrentPasswordValid = await (0, user_model_1.verifyPassword)(currentPassword, user.password_hash);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }
            // Hash new password and update
            const { hashPassword } = await Promise.resolve().then(() => __importStar(require('./user.model')));
            const newPasswordHash = await hashPassword(newPassword);
            await client.query('UPDATE oms.users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', [newPasswordHash, req.session.userId]);
            logger_1.logger.info('Password changed successfully', { userId: req.session.userId });
            res.json({ message: 'Password changed successfully' });
        }
        catch (error) {
            logger_1.logger.error('Error changing password', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to change password' });
        }
        finally {
            client.release();
        }
    });
    // User management endpoints (Admin only)
    app.get('/api/users', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            const currentUserResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
            if (currentUserResult.rows.length === 0 || currentUserResult.rows[0].role !== 'admin') {
                return res.status(403).json({ message: 'Access denied' });
            }
            const merchantId = currentUserResult.rows[0].merchant_id;
            const usersResult = await client.query('SELECT user_id, username, email, phone_number, role, created_at FROM oms.users WHERE merchant_id = $1 ORDER BY created_at DESC', [merchantId]);
            res.json({ users: usersResult.rows });
        }
        catch (error) {
            logger_1.logger.error('Error fetching users', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to fetch users' });
        }
        finally {
            client.release();
        }
    });
    app.post('/api/users', async (req, res) => {
        const client = await db_1.pool.connect();
        // Declare variables at function scope so they're accessible in catch block
        let merchantId = null;
        let username = '';
        let email = '';
        let phone = '';
        let role = '';
        let passwordHash = '';
        try {
            const body = req.body;
            username = body.username;
            email = body.email;
            phone = body.phone;
            role = body.role;
            const password = body.password;
            // Verify admin access
            const currentUserResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
            if (currentUserResult.rows.length === 0 || currentUserResult.rows[0].role !== 'admin') {
                return res.status(403).json({ message: 'Access denied' });
            }
            merchantId = currentUserResult.rows[0].merchant_id;
            // Check if email already exists
            const existingUser = await client.query('SELECT user_id FROM oms.users WHERE email = $1', [email]);
            if (existingUser.rows.length > 0) {
                logger_1.logger.warn('User creation failed: email already exists', { email: email.substring(0, 3) + '***' });
                return res.status(409).json({ message: 'User with this email already exists' });
            }
            // Use merchant-provided password
            const { hashPassword } = await Promise.resolve().then(() => __importStar(require('./user.model')));
            passwordHash = await hashPassword(password);
            // Insert new user (only in users table, not merchants)
            // First, check if phone number already exists
            const existingPhone = await client.query('SELECT user_id FROM oms.users WHERE phone_number = $1', [phone]);
            if (existingPhone.rows.length > 0) {
                logger_1.logger.warn('User creation failed: phone number already exists', { phone: phone.substring(0, 3) + '***' });
                return res.status(409).json({ message: 'User with this phone number already exists' });
            }
            // Check if username already exists for this merchant
            const existingUsername = await client.query('SELECT user_id FROM oms.users WHERE merchant_id = $1 AND username = $2', [merchantId, username]);
            if (existingUsername.rows.length > 0) {
                logger_1.logger.warn('User creation failed: username already exists for merchant', { username, merchantId });
                return res.status(409).json({ message: 'Username already exists for this merchant' });
            }
            const result = await client.query('INSERT INTO oms.users (merchant_id, username, email, phone_number, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, username, email, phone_number, role', [merchantId, username, email, phone, passwordHash, role]);
            logger_1.logger.info('User created successfully', { userId: result.rows[0].user_id, createdBy: req.session.userId });
            res.status(201).json({
                message: 'User created successfully with custom password',
                user: result.rows[0]
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger_1.logger.error('Error creating user', errorMessage);
            // Handle specific database errors
            if (errorMessage.includes('duplicate key value violates unique constraint')) {
                if (errorMessage.includes('users_pkey')) {
                    // Primary key sequence is out of sync - try to fix it automatically
                    // Make sure we have all required variables
                    if (!merchantId || !username || !email || !phone || !role || !passwordHash) {
                        logger_1.logger.error('Missing required variables for sequence fix retry', {
                            hasMerchantId: !!merchantId,
                            hasUsername: !!username,
                            hasEmail: !!email,
                            hasPhone: !!phone,
                            hasRole: !!role,
                            hasPasswordHash: !!passwordHash
                        });
                        return res.status(500).json({
                            message: 'Internal error: Missing required data for retry',
                            error: 'MISSING_VARIABLES'
                        });
                    }
                    logger_1.logger.warn('User ID sequence out of sync - attempting to fix automatically');
                    try {
                        // Get the maximum user_id from the table - use numeric comparison
                        const maxResult = await client.query(`
              SELECT MAX(CAST(user_id AS BIGINT)) as max_id 
              FROM oms.users 
              WHERE user_id IS NOT NULL
            `);
                        const maxId = maxResult.rows[0]?.max_id ? Number(maxResult.rows[0].max_id) : 0;
                        logger_1.logger.info(`Current max user_id in database: ${maxId} (type: ${typeof maxId})`);
                        // Find the next available ID by checking for gaps
                        // Start from maxId + 1 and increment until we find one that doesn't exist
                        let nextAvailableId = maxId + 1;
                        let checkedIds = 0;
                        const maxChecks = 1000; // Check up to 1000 IDs ahead
                        logger_1.logger.info(`Starting search for available ID from ${nextAvailableId}`);
                        // First, let's verify what IDs actually exist around the max
                        const sampleCheck = await client.query(`
              SELECT user_id, CAST(user_id AS BIGINT) as user_id_num
              FROM oms.users 
              WHERE CAST(user_id AS BIGINT) >= $1 
              ORDER BY CAST(user_id AS BIGINT) DESC 
              LIMIT 10
            `, [maxId - 10]);
                        logger_1.logger.info(`Sample IDs around max:`, sampleCheck.rows.map((r) => `${r.user_id} (num: ${r.user_id_num})`));
                        while (checkedIds < maxChecks) {
                            // Check if ID exists - user_id is BIGINT, so we need to compare as numbers
                            // Try multiple comparison methods to handle any type issues
                            const idCheck = await client.query(`
                SELECT user_id 
                FROM oms.users 
                WHERE CAST(user_id AS BIGINT) = $1
                LIMIT 1
              `, [nextAvailableId]);
                            if (idCheck.rows.length === 0) {
                                // Double-check: Try a more explicit query with COUNT
                                const doubleCheck = await client.query(`
                  SELECT COUNT(*)::integer as count 
                  FROM oms.users 
                  WHERE user_id = $1
                `, [nextAvailableId]);
                                const count = typeof doubleCheck.rows[0]?.count === 'string'
                                    ? parseInt(doubleCheck.rows[0].count, 10)
                                    : doubleCheck.rows[0]?.count || 0;
                                if (count === 0) {
                                    // Found an available ID
                                    logger_1.logger.info(`Found available ID: ${nextAvailableId} after checking ${checkedIds} IDs (double-checked)`);
                                    break;
                                }
                                else {
                                    logger_1.logger.warn(`ID ${nextAvailableId} exists (found by double-check, count=${count}), continuing search...`);
                                }
                            }
                            else {
                                logger_1.logger.info(`ID ${nextAvailableId} exists: ${JSON.stringify(idCheck.rows[0])}`);
                            }
                            nextAvailableId++;
                            checkedIds++;
                            // Log progress every 100 checks
                            if (checkedIds % 100 === 0) {
                                logger_1.logger.info(`Checked ${checkedIds} IDs, current candidate: ${nextAvailableId}`);
                            }
                        }
                        if (checkedIds >= maxChecks) {
                            logger_1.logger.error(`Could not find available ID after checking ${maxChecks} IDs. Max ID: ${maxId}`);
                            return res.status(500).json({
                                message: 'Could not find available user ID. Database may need manual cleanup.',
                                error: 'NO_AVAILABLE_ID'
                            });
                        }
                        logger_1.logger.info(`Next available user_id: ${nextAvailableId} (checked ${checkedIds} IDs)`);
                        // Find the sequence name - try multiple methods
                        let sequenceName = null;
                        // Method 1: Use pg_get_serial_sequence (most reliable)
                        const seqResult = await client.query(`
              SELECT pg_get_serial_sequence('oms.users', 'user_id') as sequence_name
            `);
                        sequenceName = seqResult.rows[0]?.sequence_name;
                        // Method 2: If that fails, search by pattern
                        if (!sequenceName) {
                            const patternResult = await client.query(`
                SELECT sequencename 
                FROM pg_sequences 
                WHERE schemaname = 'oms' 
                AND sequencename LIKE '%user%id%'
                ORDER BY sequencename
                LIMIT 1
              `);
                            if (patternResult.rows.length > 0) {
                                sequenceName = `oms.${patternResult.rows[0].sequencename}`;
                            }
                        }
                        // Method 3: Try common sequence name patterns and verify they exist
                        if (!sequenceName) {
                            const commonNames = [
                                'users_user_id_seq',
                                'user_id_seq'
                            ];
                            for (const name of commonNames) {
                                try {
                                    // Test if sequence exists in oms schema
                                    const testResult = await client.query(`
                    SELECT EXISTS (
                      SELECT 1 FROM pg_class c
                      JOIN pg_namespace n ON n.oid = c.relnamespace
                      WHERE n.nspname = 'oms'
                      AND c.relname = $1
                      AND c.relkind = 'S'
                    ) as exists
                  `, [name]);
                                    if (testResult.rows[0]?.exists) {
                                        sequenceName = `oms.${name}`;
                                        break;
                                    }
                                }
                                catch {
                                    continue;
                                }
                            }
                        }
                        // If sequence doesn't exist, create it
                        if (!sequenceName) {
                            logger_1.logger.warn('Sequence not found, attempting to create one');
                            try {
                                // Check if user_id column has a default that references a sequence
                                const defaultCheck = await client.query(`
                  SELECT column_default 
                  FROM information_schema.columns 
                  WHERE table_schema = 'oms' 
                  AND table_name = 'users' 
                  AND column_name = 'user_id'
                `);
                                const defaultValue = defaultCheck.rows[0]?.column_default;
                                logger_1.logger.info(`user_id default value: ${defaultValue}`);
                                // Create sequence if it doesn't exist
                                const seqName = 'users_user_id_seq';
                                // Use nextAvailableId instead of maxId + 1 to avoid conflicts
                                const startValue = nextAvailableId;
                                // Create sequence - can't use parameterized query for sequence name
                                await client.query(`
                  CREATE SEQUENCE IF NOT EXISTS oms.${seqName}
                  START WITH ${startValue}
                  INCREMENT BY 1
                  NO MINVALUE
                  NO MAXVALUE
                  CACHE 1
                `);
                                // Set the sequence owner to the users table
                                await client.query(`
                  ALTER SEQUENCE oms.${seqName} OWNED BY oms.users.user_id
                `);
                                // Set the default value for user_id column to use the sequence
                                await client.query(`
                  ALTER TABLE oms.users 
                  ALTER COLUMN user_id SET DEFAULT nextval('oms.${seqName}')
                `);
                                sequenceName = `oms.${seqName}`;
                                logger_1.logger.info(`Created sequence ${sequenceName} starting at ${startValue}`);
                            }
                            catch (createError) {
                                logger_1.logger.error('Failed to create sequence', createError instanceof Error ? createError.message : String(createError));
                                return res.status(500).json({
                                    message: 'Failed to create database sequence. Please contact support.',
                                    error: 'SEQUENCE_CREATION_FAILED'
                                });
                            }
                        }
                        // Reset the sequence to the next available ID
                        // PostgreSQL sequence behavior:
                        // - setval(seq, val, false): nextval() will return val
                        // - setval(seq, val, true): nextval() will return val + 1
                        // We want nextval() to return nextAvailableId, so:
                        // Option 1: setval(seq, nextAvailableId, false) → nextval() = nextAvailableId ✓
                        // Option 2: setval(seq, nextAvailableId-1, true) → nextval() = nextAvailableId ✓
                        // Using Option 2 (more standard)
                        try {
                            // First, verify the sequence current value
                            const currentSeqValue = await client.query(`SELECT last_value, is_called FROM ${sequenceName}`);
                            logger_1.logger.info(`Sequence ${sequenceName} current state:`, currentSeqValue.rows[0]);
                            // Set sequence to generate nextAvailableId on next call
                            await client.query(`SELECT setval($1, $2, true)`, [sequenceName, nextAvailableId - 1]);
                            logger_1.logger.info(`Sequence ${sequenceName} reset to ${nextAvailableId - 1} with is_called=true (next value will be ${nextAvailableId})`);
                            // Verify the sequence was set correctly (without consuming a value)
                            const verifySeq = await client.query(`SELECT last_value, is_called FROM ${sequenceName}`);
                            // When is_called=true, nextval() returns last_value + 1
                            // Ensure we're doing numeric addition, not string concatenation
                            const lastValue = Number(verifySeq.rows[0].last_value);
                            const isCalled = verifySeq.rows[0].is_called;
                            const expectedNext = isCalled ? lastValue + 1 : lastValue;
                            logger_1.logger.info(`Sequence ${sequenceName} after reset: last_value=${lastValue} (type: ${typeof lastValue}), is_called=${isCalled}, expected next=${expectedNext}`);
                            if (expectedNext !== nextAvailableId) {
                                logger_1.logger.error(`Sequence will generate ${expectedNext} but we need ${nextAvailableId}. This is a critical error.`);
                                throw new Error(`Sequence configuration failed: expected ${nextAvailableId} but sequence will generate ${expectedNext}`);
                            }
                            logger_1.logger.info(`✓ Sequence correctly configured to generate ${nextAvailableId} on next call`);
                        }
                        catch (setvalError) {
                            logger_1.logger.error('Failed to set sequence value', setvalError instanceof Error ? setvalError.message : String(setvalError));
                            // Try with string interpolation for sequence name
                            const seqNameOnly = sequenceName.replace('oms.', '');
                            try {
                                await client.query(`SELECT setval('oms.${seqNameOnly}', ${nextAvailableId - 1}, true)`);
                                logger_1.logger.info(`Sequence reset using alternative method to ${nextAvailableId - 1}`);
                            }
                            catch (altError) {
                                logger_1.logger.error('Alternative setval also failed', altError instanceof Error ? altError.message : String(altError));
                                throw setvalError; // Re-throw original error
                            }
                        }
                        // Retry the insert - let database auto-generate the ID
                        logger_1.logger.info('Retrying user creation with auto-generated ID');
                        // Since the sequence might still generate a duplicate, let's try inserting with explicit ID
                        // First, verify one more time that the ID doesn't exist
                        const finalCheck = await client.query(`
              SELECT COUNT(*)::integer as count 
              FROM oms.users 
              WHERE user_id = $1
            `, [nextAvailableId]);
                        const finalCount = typeof finalCheck.rows[0]?.count === 'string'
                            ? parseInt(finalCheck.rows[0].count, 10)
                            : finalCheck.rows[0]?.count || 0;
                        if (finalCount > 0) {
                            logger_1.logger.error(`ID ${nextAvailableId} exists in database (count=${finalCount}), but our checks missed it. Finding next available...`);
                            // Find the actual next available ID by querying
                            const gapQuery = await client.query(`
                SELECT generate_series($1::bigint, $2::bigint) as candidate_id
                EXCEPT
                SELECT user_id FROM oms.users WHERE user_id >= $1
                ORDER BY candidate_id
                LIMIT 1
              `, [nextAvailableId, nextAvailableId + 100]);
                            if (gapQuery.rows.length > 0) {
                                const actualAvailableId = Number(gapQuery.rows[0].candidate_id);
                                logger_1.logger.info(`Found actual available ID using gap query: ${actualAvailableId}`);
                                // Insert with explicit ID
                                const retryResult = await client.query('INSERT INTO oms.users (user_id, merchant_id, username, email, phone_number, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING user_id, username, email, phone_number, role', [actualAvailableId, merchantId, username, email, phone, passwordHash, role]);
                                // Update sequence to be ahead of this ID
                                await client.query(`SELECT setval($1, $2, true)`, [sequenceName, actualAvailableId]);
                                logger_1.logger.info(`User created successfully with explicit ID ${actualAvailableId}, sequence updated`);
                                logger_1.logger.info('User created successfully after sequence reset', { userId: retryResult.rows[0].user_id, createdBy: req.session.userId });
                                return res.status(201).json({
                                    message: 'User created successfully with custom password',
                                    user: retryResult.rows[0]
                                });
                            }
                            else {
                                throw new Error(`Could not find available ID even using gap query`);
                            }
                        }
                        // If ID doesn't exist, proceed with normal insert
                        try {
                            const retryResult = await client.query('INSERT INTO oms.users (merchant_id, username, email, phone_number, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, username, email, phone_number, role', [merchantId, username, email, phone, passwordHash, role]);
                            logger_1.logger.info('User created successfully after sequence reset', { userId: retryResult.rows[0].user_id, createdBy: req.session.userId });
                            return res.status(201).json({
                                message: 'User created successfully with custom password',
                                user: retryResult.rows[0]
                            });
                        }
                        catch (insertError) {
                            // If INSERT still fails with duplicate key, use gap query to find available ID
                            if (insertError?.message?.includes('duplicate key value violates unique constraint')) {
                                logger_1.logger.warn(`INSERT failed with duplicate key even after sequence reset. Using gap query to find available ID...`);
                                // Find the actual next available ID using a more reliable gap query
                                // Use NOT EXISTS instead of NOT IN for better reliability
                                // Start from nextAvailableId + 1 since we know nextAvailableId exists
                                let actualAvailableId = null;
                                let attempts = 0;
                                const maxGapAttempts = 10;
                                while (!actualAvailableId && attempts < maxGapAttempts) {
                                    const startId = nextAvailableId + 1 + (attempts * 100);
                                    const endId = startId + 99;
                                    const gapQuery = await client.query(`
                    SELECT candidate_id
                    FROM generate_series($1::bigint, $2::bigint) as candidate_id
                    WHERE NOT EXISTS (
                      SELECT 1 FROM oms.users WHERE user_id = candidate_id
                    )
                    ORDER BY candidate_id
                    LIMIT 1
                  `, [startId, endId]);
                                    if (gapQuery.rows.length > 0) {
                                        actualAvailableId = Number(gapQuery.rows[0].candidate_id);
                                        logger_1.logger.info(`Found actual available ID using gap query: ${actualAvailableId} (attempt ${attempts + 1}, searched ${startId}-${endId})`);
                                        break;
                                    }
                                    attempts++;
                                    logger_1.logger.warn(`No available ID found in range ${startId}-${endId}, trying next range...`);
                                }
                                if (actualAvailableId) {
                                    // Double-check the ID doesn't exist before inserting
                                    const finalVerify = await client.query(`
                    SELECT COUNT(*)::integer as count 
                    FROM oms.users 
                    WHERE user_id = $1
                  `, [actualAvailableId]);
                                    const verifyCount = typeof finalVerify.rows[0]?.count === 'string'
                                        ? parseInt(finalVerify.rows[0].count, 10)
                                        : finalVerify.rows[0]?.count || 0;
                                    if (verifyCount > 0) {
                                        logger_1.logger.error(`ID ${actualAvailableId} exists (count=${verifyCount}) even though gap query said it doesn't! Trying next ID...`);
                                        actualAvailableId = actualAvailableId + 1;
                                        // Verify this one too
                                        const verify2 = await client.query(`SELECT COUNT(*)::integer as count FROM oms.users WHERE user_id = $1`, [actualAvailableId]);
                                        const count2 = typeof verify2.rows[0]?.count === 'string' ? parseInt(verify2.rows[0].count, 10) : verify2.rows[0]?.count || 0;
                                        if (count2 > 0) {
                                            throw new Error(`Both ${actualAvailableId - 1} and ${actualAvailableId} exist. Database may be corrupted.`);
                                        }
                                    }
                                    // Insert with explicit ID
                                    const explicitInsertResult = await client.query('INSERT INTO oms.users (user_id, merchant_id, username, email, phone_number, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING user_id, username, email, phone_number, role', [actualAvailableId, merchantId, username, email, phone, passwordHash, role]);
                                    // Update sequence to be ahead of this ID
                                    await client.query(`SELECT setval($1, $2, true)`, [sequenceName, actualAvailableId]);
                                    logger_1.logger.info(`User created successfully with explicit ID ${actualAvailableId}, sequence updated`);
                                    return res.status(201).json({
                                        message: 'User created successfully with custom password',
                                        user: explicitInsertResult.rows[0]
                                    });
                                }
                                else {
                                    throw new Error(`Could not find available ID after ${maxGapAttempts} gap query attempts`);
                                }
                            }
                            else {
                                // Re-throw if it's not a duplicate key error
                                throw insertError;
                            }
                        }
                    }
                    catch (retryError) {
                        const retryErrorMsg = retryError instanceof Error ? retryError.message : String(retryError);
                        logger_1.logger.error('Failed to fix sequence and retry', retryErrorMsg);
                        // If it's still a duplicate key error after all our attempts, provide more helpful error
                        if (retryErrorMsg.includes('duplicate key value violates unique constraint')) {
                            return res.status(500).json({
                                message: 'Unable to create user due to database sequence issue. The system attempted to fix this automatically but failed. Please try again or contact support.',
                                error: 'SEQUENCE_OUT_OF_SYNC',
                                details: 'Multiple attempts to find available user ID failed'
                            });
                        }
                        return res.status(500).json({
                            message: 'Database sequence error. Please contact support.',
                            error: 'SEQUENCE_OUT_OF_SYNC'
                        });
                    }
                }
                else if (errorMessage.includes('email')) {
                    return res.status(409).json({ message: 'User with this email already exists' });
                }
                else if (errorMessage.includes('phone_number')) {
                    return res.status(409).json({ message: 'User with this phone number already exists' });
                }
            }
            res.status(500).json({ message: 'Failed to create user', error: errorMessage });
        }
        finally {
            client.release();
        }
    });
    app.put('/api/users/:userId/role', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            const { userId } = req.params;
            const { role } = req.body;
            // Verify admin access
            const currentUserResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
            if (currentUserResult.rows.length === 0 || currentUserResult.rows[0].role !== 'admin') {
                return res.status(403).json({ message: 'Access denied' });
            }
            const merchantId = currentUserResult.rows[0].merchant_id;
            // Update user role (only for users in same merchant)
            const result = await client.query('UPDATE oms.users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND merchant_id = $3 RETURNING user_id', [role, userId, merchantId]);
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'User not found or access denied' });
            }
            logger_1.logger.info('User role updated', { userId, newRole: role, updatedBy: req.session.userId });
            res.json({ message: 'Role updated successfully' });
        }
        catch (error) {
            logger_1.logger.error('Error updating user role', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to update role' });
        }
        finally {
            client.release();
        }
    });
    app.delete('/api/users/:userId', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            const { userId } = req.params;
            // Verify admin access
            const currentUserResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
            if (currentUserResult.rows.length === 0 || currentUserResult.rows[0].role !== 'admin') {
                return res.status(403).json({ message: 'Access denied' });
            }
            const merchantId = currentUserResult.rows[0].merchant_id;
            // Prevent admin from deleting themselves
            if (userId === req.session.userId) {
                return res.status(400).json({ message: 'Cannot delete your own account' });
            }
            // Delete user (only from same merchant, and not admin role)
            const result = await client.query('DELETE FROM oms.users WHERE user_id = $1 AND merchant_id = $2 AND role != $3 RETURNING user_id', [userId, merchantId, 'admin']);
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'User not found, access denied, or cannot delete admin' });
            }
            logger_1.logger.info('User deleted', { userId, deletedBy: req.session.userId });
            res.json({ message: 'User deleted successfully' });
        }
        catch (error) {
            logger_1.logger.error('Error deleting user', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to delete user' });
        }
        finally {
            client.release();
        }
    });
    // Customer details endpoint
    app.get('/api/customers/:customerId', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            const { customerId } = req.params;
            const currentUserResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
            if (currentUserResult.rows.length === 0) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const merchantId = currentUserResult.rows[0].merchant_id;
            const result = await client.query('SELECT name, phone, email, address_line1, address_line2, landmark, city, state, pincode, delivery_note, state_code, gst_number FROM oms.customers WHERE customer_id = $1 AND merchant_id = $2', [customerId, merchantId]);
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Customer not found' });
            }
            res.json(result.rows[0]);
        }
        catch (error) {
            logger_1.logger.error('Error fetching customer details', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to fetch customer details' });
        }
        finally {
            client.release();
        }
    });
    // Order assignment endpoints - using order_status_history for tracking
    app.post('/api/orders/assign', async (req, res) => {
        logger_1.logger.info('Order assignment request', { body: req.body, userId: req.session.userId });
        const client = await db_1.pool.connect();
        try {
            const { orderId, userId, deliveryNotes } = req.body;
            if (!orderId || !userId) {
                logger_1.logger.error('Missing required fields', { orderId, userId });
                return res.status(400).json({ message: 'Order ID and User ID are required' });
            }
            // Verify admin access
            const currentUserResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
            logger_1.logger.info('Current user check', { currentUser: currentUserResult.rows[0] });
            if (currentUserResult.rows.length === 0 || currentUserResult.rows[0].role !== 'admin') {
                logger_1.logger.error('Access denied - not admin', { role: currentUserResult.rows[0]?.role });
                return res.status(403).json({ message: 'Access denied' });
            }
            const merchantId = currentUserResult.rows[0].merchant_id;
            // Check if order exists
            const orderCheck = await client.query('SELECT order_id, status, user_id FROM oms.orders WHERE order_id = $1 AND merchant_id = $2', [orderId, merchantId]);
            logger_1.logger.info('Order check result', { orderExists: orderCheck.rows.length > 0, order: orderCheck.rows[0] });
            if (orderCheck.rows.length === 0) {
                logger_1.logger.error('Order not found', { orderId, merchantId });
                return res.status(404).json({ message: 'Order not found' });
            }
            // Check if user exists and belongs to same merchant
            const userCheck = await client.query('SELECT user_id FROM oms.users WHERE user_id = $1 AND merchant_id = $2', [userId, merchantId]);
            logger_1.logger.info('User check result', { userExists: userCheck.rows.length > 0 });
            if (userCheck.rows.length === 0) {
                logger_1.logger.error('User not found or different merchant', { userId, merchantId });
                return res.status(404).json({ message: 'User not found' });
            }
            await client.query('BEGIN');
            const oldStatus = orderCheck.rows[0].status;
            const previousUserId = orderCheck.rows[0].user_id || null;
            logger_1.logger.info('About to update order', { orderId, userId, oldStatus, previousUserId, merchantId });
            // Update order with assigned user (using existing user_id column)
            try {
                const result = await client.query('UPDATE oms.orders SET user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND merchant_id = $3 RETURNING *', [userId, orderId, merchantId]);
                logger_1.logger.info('Order update successful', { rowsAffected: result.rowCount, orderId, userId });
                // Log assignment as a special event - don't change status, just track assignment
                // Use a special format: old_status = "assignment:{user_id}", new_status = current status
                // This way assignment doesn't appear as a status change
                await client.query('INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)', [orderId, `assignment:${userId}`, oldStatus, req.session.userId]);
                logger_1.logger.info('Status history logged successfully', { assignedUserId: userId, previousUserId });
                await client.query('COMMIT');
            }
            catch (updateError) {
                console.error('Raw database error:', updateError);
                logger_1.logger.error('Database update failed', updateError instanceof Error ? updateError.message : String(updateError));
                throw updateError;
            }
            logger_1.logger.info('Order assigned successfully', { orderId, userId, assignedBy: req.session.userId });
            // Invalidate cache after assignment to ensure fresh data
            const { invalidateUserCache } = await Promise.resolve().then(() => __importStar(require('./middleware/cache')));
            invalidateUserCache(req.session.userId);
            res.json({ message: 'Order assigned successfully', deliveryNotes });
        }
        catch (error) {
            // Try to rollback if transaction is still active, but don't fail if connection is dead
            try {
                const result = await client.query('SELECT 1');
                // Connection is alive, try rollback
                try {
                    await client.query('ROLLBACK');
                }
                catch (rollbackError) {
                    logger_1.logger.warn('Rollback failed (may not be in transaction)', rollbackError);
                }
            }
            catch (connectionError) {
                logger_1.logger.warn('Database connection is dead, skipping rollback', connectionError);
            }
            logger_1.logger.error('Error assigning order - detailed', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                orderId: req.body.orderId,
                userId: req.body.userId,
                connectionError: error instanceof Error && error.message.includes('Connection') ? 'Connection terminated' : 'Other error'
            });
            // Only send response if not already sent
            if (!res.headersSent) {
                res.status(500).json({ message: 'Failed to assign order', error: error instanceof Error ? error.message : String(error) });
            }
        }
        finally {
            // Safely release connection even if it's dead
            try {
                client.release();
            }
            catch (releaseError) {
                logger_1.logger.error('Error releasing database connection', releaseError);
                // Connection pool will handle dead connections
            }
        }
    });
    // Get assignment history for an order
    app.get('/api/orders/:orderId/assignment-history', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            const orderId = parseInt(req.params.orderId, 10);
            if (isNaN(orderId)) {
                return res.status(400).json({ message: 'Invalid order ID' });
            }
            // Verify admin access
            const currentUserResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
            if (currentUserResult.rows.length === 0 || currentUserResult.rows[0].role !== 'admin') {
                return res.status(403).json({ message: 'Access denied' });
            }
            const merchantId = currentUserResult.rows[0].merchant_id;
            // Check if order exists and belongs to merchant
            const orderCheck = await client.query('SELECT order_id FROM oms.orders WHERE order_id = $1 AND merchant_id = $2', [orderId, merchantId]);
            if (orderCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Order not found' });
            }
            // Get assignment history from order_status_history where old_status starts with 'assignment:'
            // Extract assigned user_id from old_status field (format: "assignment:{user_id}")
            const historyResult = await client.query(`SELECT 
          osh.history_id,
          osh.old_status,
          osh.new_status,
          osh.changed_by,
          osh.changed_at,
          u.username as assigned_by_name,
          u.role as assigned_by_role
        FROM oms.order_status_history osh
        LEFT JOIN oms.users u ON osh.changed_by = u.user_id
        WHERE osh.order_id = $1 AND osh.old_status LIKE 'assignment:%'
        ORDER BY osh.changed_at DESC`, [orderId]);
            // Get current assignment
            const currentAssignmentResult = await client.query(`SELECT 
          o.user_id,
          u.username as assigned_user_name,
          u.role as assigned_user_role
        FROM oms.orders o
        LEFT JOIN oms.users u ON o.user_id = u.user_id
        WHERE o.order_id = $1 AND o.user_id IS NOT NULL`, [orderId]);
            const assignments = [];
            // Add current assignment if exists
            if (currentAssignmentResult.rows.length > 0 && currentAssignmentResult.rows[0].user_id) {
                assignments.push({
                    user_id: currentAssignmentResult.rows[0].user_id,
                    username: currentAssignmentResult.rows[0].assigned_user_name,
                    role: currentAssignmentResult.rows[0].assigned_user_role,
                    assigned_at: null, // We don't have exact timestamp for current assignment
                    is_current: true
                });
            }
            // Add historical assignments
            // Extract assigned user_id from old_status (format: "assigned:{user_id}")
            const seenUserIds = new Set();
            if (currentAssignmentResult.rows.length > 0 && currentAssignmentResult.rows[0].user_id) {
                seenUserIds.add(currentAssignmentResult.rows[0].user_id);
            }
            for (const row of historyResult.rows) {
                // Extract user_id from old_status field (format: "assignment:{user_id}")
                const assignedUserIdMatch = row.old_status?.match(/^assignment:(\d+)$/);
                if (assignedUserIdMatch) {
                    const assignedUserId = parseInt(assignedUserIdMatch[1], 10);
                    // Skip if we've already added this user
                    if (seenUserIds.has(assignedUserId)) {
                        continue;
                    }
                    // Check if this is the current assignment
                    const isCurrent = currentAssignmentResult.rows.length > 0 &&
                        currentAssignmentResult.rows[0].user_id === assignedUserId;
                    // Fetch user details for the assigned user
                    const assignedUserResult = await client.query('SELECT username, role FROM oms.users WHERE user_id = $1', [assignedUserId]);
                    if (assignedUserResult.rows.length > 0) {
                        assignments.push({
                            user_id: assignedUserId,
                            username: assignedUserResult.rows[0].username || 'Unknown',
                            role: assignedUserResult.rows[0].role || 'Unknown',
                            assigned_at: row.changed_at,
                            is_current: isCurrent
                        });
                        seenUserIds.add(assignedUserId);
                    }
                }
            }
            res.json({ assignments });
        }
        catch (error) {
            logger_1.logger.error('Error fetching assignment history', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to fetch assignment history' });
        }
        finally {
            client.release();
        }
    });
}
//# sourceMappingURL=routes.js.map