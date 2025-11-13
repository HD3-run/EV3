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
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.createUser = createUser;
exports.findUserByEmail = findUserByEmail;
exports.findUserByPhone = findUserByPhone;
exports.findUserByEmailOrPhone = findUserByEmailOrPhone;
exports.findUserById = findUserById;
const db_1 = __importDefault(require("./db"));
const logger_1 = require("./utils/logger");
const password_1 = require("./utils/password");
async function hashPassword(password) {
    try {
        return await (0, password_1.hashPasswordArgon2)(password);
    }
    catch (error) {
        logger_1.logger.error('Password hashing failed', error instanceof Error ? error.message : String(error));
        throw new Error('Password hashing failed');
    }
}
async function verifyPassword(password, hash) {
    try {
        // Import universal verifier that handles both Argon2 and legacy formats
        const { verifyPassword: universalVerify } = await Promise.resolve().then(() => __importStar(require('./utils/password')));
        return await universalVerify(password, hash);
    }
    catch (error) {
        logger_1.logger.error('Password verification failed', error instanceof Error ? error.message : String(error));
        return false;
    }
}
async function createUser(username, email, passwordPlain, phoneNumber, businessName) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Create merchant if not exists
        let merchantResult = await client.query('SELECT merchant_id FROM oms.merchants WHERE email = $1', [email]);
        let merchantId;
        if (merchantResult.rows.length === 0) {
            merchantResult = await client.query('INSERT INTO oms.merchants(merchant_name, contact_person_name, email, phone_number) VALUES($1, $2, $3, $4) RETURNING merchant_id', [businessName, username, email, phoneNumber]);
            merchantId = merchantResult.rows[0].merchant_id;
        }
        else {
            merchantId = merchantResult.rows[0].merchant_id;
        }
        const password_hash = await hashPassword(passwordPlain);
        const result = await client.query('INSERT INTO oms.users(merchant_id, username, email, phone_number, password_hash, role) VALUES($1, $2, $3, $4, $5, $6) RETURNING user_id, username, email, role, created_at, updated_at', [merchantId, username, email, phoneNumber, password_hash, 'admin']);
        await client.query('COMMIT');
        return result.rows[0];
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error creating user', error instanceof Error ? error.message : String(error));
        return null;
    }
    finally {
        client.release();
    }
}
async function findUserByEmail(email) {
    const client = await db_1.default.connect();
    try {
        const result = await client.query('SELECT user_id, username, email, password_hash, role, created_at, updated_at FROM oms.users WHERE email = $1', [email]);
        return result.rows[0] || null;
    }
    catch (error) {
        logger_1.logger.error('Error finding user by email', error instanceof Error ? error.message : String(error));
        return null;
    }
    finally {
        client.release();
    }
}
async function findUserByPhone(phoneNumber) {
    const client = await db_1.default.connect();
    try {
        const result = await client.query('SELECT user_id, username, email, password_hash, role, created_at, updated_at FROM oms.users WHERE phone_number = $1', [phoneNumber]);
        return result.rows[0] || null;
    }
    catch (error) {
        logger_1.logger.error('Error finding user by phone', error instanceof Error ? error.message : String(error));
        return null;
    }
    finally {
        client.release();
    }
}
async function findUserByEmailOrPhone(emailOrPhone) {
    const client = await db_1.default.connect();
    try {
        // First try to find by email
        let result = await client.query('SELECT user_id, username, email, password_hash, role, created_at, updated_at FROM oms.users WHERE email = $1', [emailOrPhone]);
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        // If not found by email, try by phone number
        result = await client.query('SELECT user_id, username, email, password_hash, role, created_at, updated_at FROM oms.users WHERE phone_number = $1', [emailOrPhone]);
        return result.rows[0] || null;
    }
    catch (error) {
        logger_1.logger.error('Error finding user by email or phone', error instanceof Error ? error.message : String(error));
        return null;
    }
    finally {
        client.release();
    }
}
async function findUserById(userId) {
    const client = await db_1.default.connect();
    try {
        const result = await client.query('SELECT user_id, username, email, password_hash, role, created_at, updated_at FROM oms.users WHERE user_id = $1', [userId]);
        return result.rows[0] || null;
    }
    catch (error) {
        logger_1.logger.error('Error finding user by ID', error instanceof Error ? error.message : String(error));
        return null;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=user.model.js.map