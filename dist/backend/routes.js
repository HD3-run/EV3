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
const auth_1 = require("./middleware/auth");
const validation_1 = require("./middleware/validation");
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
            created_at: user.created_at
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
    app.use('/api/orders', auth_1.authenticateUser, orders_1.default);
    app.use('/api/inventory', auth_1.authenticateUser, inventory_1.default);
    app.use('/api/reports', auth_1.authenticateUser, reports_1.default);
    app.use('/api/invoices', auth_1.authenticateUser, invoices_1.default);
    app.use('/api/billing-details', auth_1.authenticateUser, billing_details_1.default);
    app.use('/api/returns', auth_1.authenticateUser, returns_1.default);
    // Add debug endpoint for development
    if (process.env.NODE_ENV === 'development') {
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
        try {
            const { username, email, phone, role, password } = req.body;
            // Verify admin access
            const currentUserResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
            if (currentUserResult.rows.length === 0 || currentUserResult.rows[0].role !== 'admin') {
                return res.status(403).json({ message: 'Access denied' });
            }
            const merchantId = currentUserResult.rows[0].merchant_id;
            // Check if email already exists
            const existingUser = await client.query('SELECT user_id FROM oms.users WHERE email = $1', [email]);
            if (existingUser.rows.length > 0) {
                return res.status(409).json({ message: 'User with this email already exists' });
            }
            // Use merchant-provided password
            const { hashPassword } = await Promise.resolve().then(() => __importStar(require('./user.model')));
            const passwordHash = await hashPassword(password);
            // Insert new user (only in users table, not merchants)
            const result = await client.query('INSERT INTO oms.users (merchant_id, username, email, phone_number, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, username, email, phone_number, role', [merchantId, username, email, phone, passwordHash, role]);
            logger_1.logger.info('User created successfully', { userId: result.rows[0].user_id, createdBy: req.session.userId });
            res.status(201).json({
                message: 'User created successfully with custom password',
                user: result.rows[0]
            });
        }
        catch (error) {
            logger_1.logger.error('Error creating user', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to create user' });
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
            const orderCheck = await client.query('SELECT order_id, status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2', [orderId, merchantId]);
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
            logger_1.logger.info('About to update order', { orderId, userId, oldStatus, merchantId });
            // Update order with assigned user (using existing user_id column)
            try {
                const result = await client.query('UPDATE oms.orders SET user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND merchant_id = $3 RETURNING *', [userId, orderId, merchantId]);
                logger_1.logger.info('Order update successful', { rowsAffected: result.rowCount, orderId, userId });
                // Log assignment in order status history
                await client.query('INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)', [orderId, oldStatus, oldStatus, req.session.userId]);
                logger_1.logger.info('Status history logged successfully');
                await client.query('COMMIT');
            }
            catch (updateError) {
                console.error('Raw database error:', updateError);
                logger_1.logger.error('Database update failed', updateError instanceof Error ? updateError.message : String(updateError));
                throw updateError;
            }
            logger_1.logger.info('Order assigned successfully', { orderId, userId, assignedBy: req.session.userId });
            res.json({ message: 'Order assigned successfully', deliveryNotes });
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger_1.logger.error('Error assigning order - detailed', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                orderId: req.body.orderId,
                userId: req.body.userId
            });
            res.status(500).json({ message: 'Failed to assign order', error: error instanceof Error ? error.message : String(error) });
        }
        finally {
            client.release();
        }
    });
    // Employee endpoints - using actual schema
    app.get('/api/employee/assigned-orders', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            const result = await client.query(`
        SELECT o.order_id, o.order_date, o.total_amount, o.status, o.order_source,
               c.name as customer_name, c.phone as customer_phone, c.address as delivery_address
        FROM oms.orders o
        LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
        WHERE o.user_id = $1 AND o.status = 'shipped'
        ORDER BY o.order_date DESC
      `, [req.session.userId]);
            res.json({ orders: result.rows });
        }
        catch (error) {
            logger_1.logger.error('Error fetching assigned orders', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to fetch assigned orders' });
        }
        finally {
            client.release();
        }
    });
    app.get('/api/employee/orders', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            const result = await client.query(`
        SELECT o.order_id, o.order_date, o.total_amount, o.status, o.order_source,
               c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as delivery_address
        FROM oms.orders o
        LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
        WHERE o.user_id = $1
        ORDER BY o.order_date DESC
      `, [req.session.userId]);
            res.json({ orders: result.rows });
        }
        catch (error) {
            logger_1.logger.error('Error fetching employee orders', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to fetch orders' });
        }
        finally {
            client.release();
        }
    });
    app.put('/api/employee/orders/:orderId/status', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            const { orderId } = req.params;
            const { status } = req.body;
            logger_1.logger.info('PUT /api/employee/orders/:orderId/status', { orderId, status, userId: req.session.userId });
            // Import status validation utilities
            const { isValidEmployeeStatusTransition, getAllowedStatusTransitions, requiresPaymentValidation } = await Promise.resolve().then(() => __importStar(require('./utils/status-validation')));
            const { ORDER_STATUS } = await Promise.resolve().then(() => __importStar(require('./utils/constants')));
            // Validate status value
            const validStatuses = Object.values(ORDER_STATUS);
            if (!validStatuses.includes(status)) {
                logger_1.logger.error('Invalid status value', { status, validStatuses });
                return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
            }
            await client.query('BEGIN');
            // Get user role first
            const userResult = await client.query('SELECT role FROM oms.users WHERE user_id = $1', [req.session.userId]);
            if (userResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'User not found' });
            }
            const userRole = userResult.rows[0].role;
            // Get current status and payment status
            const currentOrder = await client.query('SELECT status, payment_status FROM oms.orders WHERE order_id = $1 AND user_id = $2', [orderId, req.session.userId]);
            if (currentOrder.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Order not found or not assigned to you' });
            }
            const oldStatus = currentOrder.rows[0].status;
            const paymentStatus = currentOrder.rows[0].payment_status;
            logger_1.logger.info('Status update details', { orderId, oldStatus, newStatus: status, paymentStatus, userRole });
            // Role-based status validation
            const isRoleBasedTransitionAllowed = (role, fromStatus, toStatus) => {
                // Admin can change any status to any other status
                if (role === 'admin') {
                    return true;
                }
                // NO ROLE can change status from 'assigned' - only admin can do this
                if (fromStatus === 'assigned') {
                    return false;
                }
                // Delivery role permissions
                if (role === 'Delivery') {
                    if (fromStatus === 'confirmed' && (toStatus === 'shipped' || toStatus === 'delivered' || toStatus === 'cancelled')) {
                        return true;
                    }
                    return false;
                }
                // Manager role permissions
                if (role === 'Manager') {
                    if (fromStatus === 'confirmed' && (toStatus === 'shipped' || toStatus === 'cancelled' || toStatus === 'returned')) {
                        return true;
                    }
                    return false;
                }
                // Employee role permissions
                if (role === 'Employee') {
                    if (fromStatus === 'confirmed' && (toStatus === 'shipped' || toStatus === 'delivered' || toStatus === 'cancelled')) {
                        return true;
                    }
                    return false;
                }
                // For any other role (should not happen with proper validation)
                return false;
            };
            // Validate status transition using role-based business rules
            if (!isRoleBasedTransitionAllowed(userRole, oldStatus, status)) {
                const allowedTransitions = getAllowedStatusTransitions(oldStatus);
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Invalid status transition from '${oldStatus}' to '${status}' for role '${userRole}'. Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none (final status)'}`
                });
            }
            // Payment validation for specific statuses
            if (requiresPaymentValidation(status) && paymentStatus !== 'paid') {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Please mark the order as paid first before changing to '${status}'`
                });
            }
            // Update order status
            await client.query('UPDATE oms.orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND user_id = $3', [status, orderId, req.session.userId]);
            // Log status change
            await client.query('INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)', [orderId, oldStatus, status, req.session.userId]);
            await client.query('COMMIT');
            logger_1.logger.info('Order status updated by employee', { orderId, status, userId: req.session.userId });
            res.json({ message: 'Order status updated successfully' });
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger_1.logger.error('Error updating order status | Data:', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Failed to update order status' });
        }
        finally {
            client.release();
        }
    });
}
//# sourceMappingURL=routes.js.map