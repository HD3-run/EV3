// Customer form field handlers

import { validatePhoneNumber, validateEmail } from '../utils/validation';
import type { OrderFormData, FormErrors } from '../types/order.types';

/**
 * Handle phone number change with real-time validation (exactly 10 digits)
 */
export const handlePhoneChange = (
  value: string,
  setNewOrder: (updater: (prev: OrderFormData) => OrderFormData) => void,
  formErrors: FormErrors,
  setFormErrors: (errors: FormErrors) => void
) => {
  // Only allow digits and limit to 10 characters
  const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
  setNewOrder(prev => ({ ...prev, customerPhone: digitsOnly }));

  // Real-time validation
  if (digitsOnly.length > 0 && digitsOnly.length < 10) {
    setFormErrors({ ...formErrors, customerPhone: 'Please enter a valid 10-digit Indian phone number' });
  } else if (digitsOnly.length === 10 && !validatePhoneNumber(digitsOnly)) {
    setFormErrors({ ...formErrors, customerPhone: 'Phone number must start with 6, 7, 8, or 9' });
  } else {
    setFormErrors({ ...formErrors, customerPhone: '' });
  }
};

/**
 * Handle email change with real-time validation
 */
export const handleEmailChange = (
  value: string,
  setNewOrder: (updater: (prev: OrderFormData) => OrderFormData) => void,
  formErrors: FormErrors,
  setFormErrors: (errors: FormErrors) => void
) => {
  setNewOrder(prev => ({ ...prev, customerEmail: value }));

  // Real-time validation
  if (value.trim() && !validateEmail(value)) {
    setFormErrors({ ...formErrors, customerEmail: 'Please enter a valid email address' });
  } else {
    setFormErrors({ ...formErrors, customerEmail: '' });
  }
};

