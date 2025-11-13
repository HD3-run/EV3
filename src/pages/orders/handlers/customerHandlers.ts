// Customer-related handlers

import { loadCustomerDetails } from '../queries/customerQueries';

export interface CustomerDetailsCallbacks {
  setSelectedCustomerDetails: (details: any) => void;
  setShowCustomerDetailsModal: (show: boolean) => void;
}

/**
 * Handle viewing customer details
 */
export async function handleViewCustomerDetails(
  customerId: string,
  callbacks: CustomerDetailsCallbacks
): Promise<void> {
  try {
    const details = await loadCustomerDetails(customerId);
    callbacks.setSelectedCustomerDetails(details);
    callbacks.setShowCustomerDetailsModal(true);
  } catch (error) {
    console.error('Error loading customer details:', error);
    alert('Failed to load customer details');
  }
}

