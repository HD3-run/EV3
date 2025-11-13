import pool from './db';
import { logger } from './utils/logger';
import { hashPasswordArgon2, verifyPassword as verifyPasswordArgon2 } from './utils/password';

export interface User {
  user_id: string;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: Date;
  merchant_id: string;
}

export async function hashPassword(password: string): Promise<string> {
  try {
    return await hashPasswordArgon2(password);
  } catch (error) {
    logger.error('Password hashing failed', error instanceof Error ? error.message : String(error));
    throw new Error('Password hashing failed');
  }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Import universal verifier that handles both Argon2 and legacy formats
    const { verifyPassword: universalVerify } = await import('./utils/password');
    return await universalVerify(password, hash);
  } catch (error) {
    logger.error('Password verification failed', error instanceof Error ? error.message : String(error));
    return false;
  }
}

export async function createUser(username: string, email: string, passwordPlain: string, phoneNumber: string, businessName: string): Promise<User | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create merchant if not exists
    let merchantResult = await client.query(
      'SELECT merchant_id FROM oms.merchants WHERE email = $1',
      [email]
    );
    
    let merchantId;
    if (merchantResult.rows.length === 0) {
      merchantResult = await client.query(
        'INSERT INTO oms.merchants(merchant_name, contact_person_name, email, phone_number) VALUES($1, $2, $3, $4) RETURNING merchant_id',
        [businessName, username, email, phoneNumber]
      );
      merchantId = merchantResult.rows[0].merchant_id;
    } else {
      merchantId = merchantResult.rows[0].merchant_id;
    }
    
    const password_hash = await hashPassword(passwordPlain);
    const result = await client.query(
      'INSERT INTO oms.users(merchant_id, username, email, phone_number, password_hash, role) VALUES($1, $2, $3, $4, $5, $6) RETURNING user_id, username, email, role, created_at, updated_at',
      [merchantId, username, email, phoneNumber, password_hash, 'admin']
    );
    
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating user', error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    client.release();
  }
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT user_id, username, email, password_hash, role, created_at, updated_at FROM oms.users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error finding user by email', error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    client.release();
  }
}

export async function findUserByPhone(phoneNumber: string): Promise<User | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT user_id, username, email, password_hash, role, created_at, updated_at FROM oms.users WHERE phone_number = $1',
      [phoneNumber]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error finding user by phone', error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    client.release();
  }
}

export async function findUserByEmailOrPhone(emailOrPhone: string): Promise<User | null> {
  const client = await pool.connect();
  try {
    // First try to find by email
    let result = await client.query(
      'SELECT user_id, username, email, password_hash, role, created_at, updated_at FROM oms.users WHERE email = $1',
      [emailOrPhone]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    // If not found by email, try by phone number
    result = await client.query(
      'SELECT user_id, username, email, password_hash, role, created_at, updated_at FROM oms.users WHERE phone_number = $1',
      [emailOrPhone]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error finding user by email or phone', error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    client.release();
  }
}

export async function findUserById(userId: string): Promise<User | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT user_id, username, email, password_hash, role, created_at, updated_at FROM oms.users WHERE user_id = $1',
      [userId]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error finding user by ID', error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    client.release();
  }
}