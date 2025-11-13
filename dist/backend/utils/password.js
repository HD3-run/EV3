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
exports.verifyPassword = exports.verifyPasswordBcrypt = exports.hashPasswordBcrypt = exports.verifyPasswordArgon2 = exports.hashPasswordArgon2 = void 0;
const argon2_1 = __importDefault(require("argon2"));
const bcrypt_1 = __importDefault(require("bcrypt"));
// Use Argon2 for new passwords (more secure)
const hashPasswordArgon2 = async (password) => {
    return await argon2_1.default.hash(password, {
        type: argon2_1.default.argon2id,
        memoryCost: 2 ** 16, // 64 MB
        timeCost: 3,
        parallelism: 1,
    });
};
exports.hashPasswordArgon2 = hashPasswordArgon2;
// Verify Argon2 password
const verifyPasswordArgon2 = async (password, hash) => {
    try {
        return await argon2_1.default.verify(hash, password);
    }
    catch {
        return false;
    }
};
exports.verifyPasswordArgon2 = verifyPasswordArgon2;
// Legacy bcrypt support
const hashPasswordBcrypt = async (password) => {
    return await bcrypt_1.default.hash(password, 12);
};
exports.hashPasswordBcrypt = hashPasswordBcrypt;
const verifyPasswordBcrypt = async (password, hash) => {
    return await bcrypt_1.default.compare(password, hash);
};
exports.verifyPasswordBcrypt = verifyPasswordBcrypt;
// Legacy PBKDF2 verification (for existing hashes)
const verifyPasswordPBKDF2 = async (password, hash) => {
    try {
        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
        const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
        const pbkdf2 = promisify(crypto.pbkdf2);
        const [salt, key] = hash.split(':');
        if (!salt || !key) {
            return false;
        }
        const derivedKey = await pbkdf2(password, salt, 100000, 64, 'sha512');
        return key === derivedKey.toString('hex');
    }
    catch {
        return false;
    }
};
// Universal password verification (supports Argon2, bcrypt, and legacy PBKDF2)
const verifyPassword = async (password, hash) => {
    if (hash.startsWith('$argon2')) {
        return await (0, exports.verifyPasswordArgon2)(password, hash);
    }
    else if (hash.startsWith('$2')) {
        return await (0, exports.verifyPasswordBcrypt)(password, hash);
    }
    else if (hash.includes(':') && hash.length > 100) {
        // Legacy PBKDF2 format: salt:hash
        return await verifyPasswordPBKDF2(password, hash);
    }
    else {
        return false;
    }
};
exports.verifyPassword = verifyPassword;
//# sourceMappingURL=password.js.map