/**
 * Input validation utilities for backend API endpoints
 */

export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationResult {
  public errors: ValidationError[] = [];
  
  get isValid(): boolean {
    return this.errors.length === 0;
  }
  
  addError(field: string, message: string): void {
    this.errors.push({ field, message });
  }
  
  getErrorMessages(): string[] {
    return this.errors.map(error => `${error.field}: ${error.message}`);
  }
}

// Common validation functions
export function validateRequired(value: any, fieldName: string): ValidationError | null {
  if (value === undefined || value === null || value === '') {
    return { field: fieldName, message: 'is required' };
  }
  return null;
}

export function validateEmail(email: string, fieldName: string = 'email'): ValidationError | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { field: fieldName, message: 'must be a valid email address' };
  }
  return null;
}

export function validateNumber(value: any, fieldName: string, min?: number, max?: number): ValidationError | null {
  const num = Number(value);
  if (isNaN(num)) {
    return { field: fieldName, message: 'must be a valid number' };
  }
  if (min !== undefined && num < min) {
    return { field: fieldName, message: `must be at least ${min}` };
  }
  if (max !== undefined && num > max) {
    return { field: fieldName, message: `must be at most ${max}` };
  }
  return null;
}

export function validateString(value: any, fieldName: string, minLength?: number, maxLength?: number): ValidationError | null {
  if (typeof value !== 'string') {
    return { field: fieldName, message: 'must be a string' };
  }
  if (minLength !== undefined && value.length < minLength) {
    return { field: fieldName, message: `must be at least ${minLength} characters long` };
  }
  if (maxLength !== undefined && value.length > maxLength) {
    return { field: fieldName, message: `must be at most ${maxLength} characters long` };
  }
  return null;
}

export function validatePhone(phone: string, fieldName: string = 'phone'): ValidationError | null {
  // Basic phone validation - adjust regex as needed for your requirements
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
    return { field: fieldName, message: 'must be a valid phone number' };
  }
  return null;
}

// Product validation
export function validateProduct(productData: any): ValidationResult {
  const result = new ValidationResult();
  
  const nameError = validateRequired(productData.name, 'name');
  if (nameError) result.errors.push(nameError);
  
  const nameStringError = validateString(productData.name, 'name', 1, 255);
  if (nameStringError) result.errors.push(nameStringError);
  
  if (productData.sku) {
    const skuError = validateString(productData.sku, 'sku', 1, 100);
    if (skuError) result.errors.push(skuError);
  }
  
  if (productData.category) {
    const categoryError = validateString(productData.category, 'category', 1, 100);
    if (categoryError) result.errors.push(categoryError);
  }
  
  return result;
}

// Order validation
export function validateOrder(orderData: any): ValidationResult {
  const result = new ValidationResult();
  
  const customerNameError = validateRequired(orderData.customer_name, 'customer_name');
  if (customerNameError) result.errors.push(customerNameError);
  
  const customerNameStringError = validateString(orderData.customer_name, 'customer_name', 1, 255);
  if (customerNameStringError) result.errors.push(customerNameStringError);
  
  if (orderData.customer_phone) {
    const phoneError = validatePhone(orderData.customer_phone, 'customer_phone');
    if (phoneError) result.errors.push(phoneError);
  }
  
  if (orderData.customer_email) {
    const emailError = validateEmail(orderData.customer_email, 'customer_email');
    if (emailError) result.errors.push(emailError);
  }
  
  const productNameError = validateRequired(orderData.product_name, 'product_name');
  if (productNameError) result.errors.push(productNameError);
  
  const quantityError = validateNumber(orderData.quantity, 'quantity', 1);
  if (quantityError) result.errors.push(quantityError);
  
  const unitPriceError = validateNumber(orderData.unit_price, 'unit_price', 0);
  if (unitPriceError) result.errors.push(unitPriceError);
  
  return result;
}

// Inventory validation
export function validateInventoryUpdate(inventoryData: any): ValidationResult {
  const result = new ValidationResult();
  
  if (inventoryData.stock !== undefined) {
    const stockError = validateNumber(inventoryData.stock, 'stock', 0);
    if (stockError) result.errors.push(stockError);
  }
  
  if (inventoryData.reorderLevel !== undefined) {
    const reorderError = validateNumber(inventoryData.reorderLevel, 'reorderLevel', 0);
    if (reorderError) result.errors.push(reorderError);
  }
  
  if (inventoryData.unitPrice !== undefined) {
    const priceError = validateNumber(inventoryData.unitPrice, 'unitPrice', 0);
    if (priceError) result.errors.push(priceError);
  }
  
  return result;
}

// User validation
export function validateUser(userData: any): ValidationResult {
  const result = new ValidationResult();
  
  const usernameError = validateRequired(userData.username, 'username');
  if (usernameError) result.errors.push(usernameError);
  
  const usernameStringError = validateString(userData.username, 'username', 3, 50);
  if (usernameStringError) result.errors.push(usernameStringError);
  
  const emailError = validateRequired(userData.email, 'email');
  if (emailError) result.errors.push(emailError);
  
  const emailValidError = validateEmail(userData.email);
  if (emailValidError) result.errors.push(emailValidError);
  
  if (userData.phone_number) {
    const phoneError = validatePhone(userData.phone_number, 'phone_number');
    if (phoneError) result.errors.push(phoneError);
  }
  
  if (userData.role && !['admin', 'Manager', 'Employee', 'Delivery'].includes(userData.role)) {
    result.addError('role', 'must be one of: admin, Manager, Employee, Delivery');
  }
  
  return result;
}