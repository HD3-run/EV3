// Customer-related query functions

import { getApiUrl } from '../../../config/api';

/**
 * Load customer details by customer ID
 */
export const loadCustomerDetails = async (customerId: string): Promise<any | null> => {
  try {
    const response = await fetch(getApiUrl(`/api/customers/${customerId.replace('CUS', '')}`), {
      credentials: 'include'
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      alert('Failed to load customer details');
      return null;
    }
  } catch (error) {
    console.error('Error loading customer details:', error);
    alert('Failed to load customer details');
    return null;
  }
};

