// Validation functions for orders

/**
 * Phone number validation for Indian phone numbers (exactly 10 digits)
 */
export const validatePhoneNumber = (phone: string): boolean => {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // Indian phone number: exactly 10 digits starting with 6-9
  const phoneRegex = /^[6-9]\d{9}$/;

  return phoneRegex.test(digitsOnly) && digitsOnly.length === 10;
};

/**
 * Email validation
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Form validation for order creation
 * Returns validation errors object and boolean indicating if form is valid
 */
export interface ValidationErrors {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  alternatePhone: string;
  deliveryNote: string;
  productName: string;
}

export interface OrderFormData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  alternatePhone: string;
  deliveryNote: string;
  productName: string;
  productId: string;
}

export const validateForm = (newOrder: OrderFormData): { errors: ValidationErrors; isValid: boolean } => {
  const errors: ValidationErrors = {
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    country: '',
    alternatePhone: '',
    deliveryNote: '',
    productName: ''
  };

  let isValid = true;

  // Validate customer name
  if (!newOrder.customerName.trim()) {
    errors.customerName = 'Customer name is required';
    isValid = false;
  }

  // Validate phone number
  if (!newOrder.customerPhone.trim()) {
    errors.customerPhone = 'Phone number is required';
    isValid = false;
  } else if (!validatePhoneNumber(newOrder.customerPhone)) {
    if (newOrder.customerPhone.replace(/\D/g, '').length < 10) {
      errors.customerPhone = 'Please enter a valid 10-digit Indian phone number';
    } else {
      errors.customerPhone = 'Phone number must start with 6, 7, 8, or 9';
    }
    isValid = false;
  }

  // Validate email if provided
  if (newOrder.customerEmail.trim() && !validateEmail(newOrder.customerEmail)) {
    errors.customerEmail = 'Please enter a valid email address';
    isValid = false;
  }

  // Validate address fields - required for all orders for proper GST calculation
  if (!newOrder.addressLine1.trim()) {
    errors.addressLine1 = 'Address Line 1 is required';
    isValid = false;
  }
  if (!newOrder.city.trim()) {
    errors.city = 'City is required';
    isValid = false;
  }
  if (!newOrder.state.trim()) {
    errors.state = 'State is required';
    isValid = false;
  }
  if (!newOrder.pincode.trim()) {
    errors.pincode = 'Pincode is required';
    isValid = false;
  }

  // Validate alternate phone if provided
  if (newOrder.alternatePhone.trim() && !validatePhoneNumber(newOrder.alternatePhone)) {
    const digitsOnly = newOrder.alternatePhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      errors.alternatePhone = 'Please enter a valid 10-digit Indian phone number';
    } else {
      errors.alternatePhone = 'Phone number must start with 6, 7, 8, or 9';
    }
    isValid = false;
  }

  // Validate product selection (either by name or ID)
  if (!newOrder.productName.trim() && !newOrder.productId) {
    errors.productName = 'Please select a product from inventory';
    isValid = false;
  }

  return { errors, isValid };
};

