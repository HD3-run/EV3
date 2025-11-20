import argon2 from 'argon2';
import bcrypt from 'bcrypt';

// Use Argon2 for new passwords (more secure)
export const hashPasswordArgon2 = async (password: string): Promise<string> => {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
};

// Verify Argon2 password
export const verifyPasswordArgon2 = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
};

// Legacy bcrypt support
export const hashPasswordBcrypt = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 12);
};

export const verifyPasswordBcrypt = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

// Legacy PBKDF2 verification (for existing hashes)
const verifyPasswordPBKDF2 = async (password: string, hash: string): Promise<boolean> => {
  try {
    const crypto = await import('crypto');
    const { promisify } = await import('util');
    const pbkdf2 = promisify(crypto.pbkdf2);
    
    const [salt, key] = hash.split(':');
    if (!salt || !key) {
      return false;
    }
    const derivedKey = await pbkdf2(password, salt, 100000, 64, 'sha512');
    return key === derivedKey.toString('hex');
  } catch {
    return false;
  }
};

// Universal password verification (supports Argon2, bcrypt, and legacy PBKDF2)
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  if (hash.startsWith('$argon2')) {
    return await verifyPasswordArgon2(password, hash);
  } else if (hash.startsWith('$2')) {
    return await verifyPasswordBcrypt(password, hash);
  } else if (hash.includes(':') && hash.length > 100) {
    // Legacy PBKDF2 format: salt:hash
    return await verifyPasswordPBKDF2(password, hash);
  } else {
    return false;
  }
};