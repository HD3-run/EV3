// Address handling functions for order forms

import { LANDMARK_MAP } from '../constants/orderConstants';
import type { OrderFormData } from '../types/order.types';

/**
 * Enhanced pincode lookup function using Indian pincode API
 */
export const handlePincodeLookup = async (
  pincode: string,
  setNewOrder: (updater: (prev: OrderFormData) => OrderFormData) => void,
  setPincodeLoading: (loading: boolean) => void
) => {
  if (pincode.length !== 6) return;
  
  setPincodeLoading(true);
  try {
    // Using a free Indian pincode API
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();
    
    if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
      const postOffice = data[0].PostOffice[0];
      
      // Create address line 1 from available post office data
      let addressLine1 = '';
      if (postOffice.Name && postOffice.Name !== postOffice.District) {
        // Use post office name as address line 1 if it's different from district
        addressLine1 = postOffice.Name;
      } else if (postOffice.Block && postOffice.Block !== postOffice.District) {
        // Use block name if post office name is same as district
        addressLine1 = postOffice.Block;
      } else if (postOffice.Division && postOffice.Division !== postOffice.District) {
        // Use division as fallback
        addressLine1 = postOffice.Division;
      }
      
      setNewOrder(prev => ({
        ...prev,
        city: postOffice.District || prev.city,
        state: postOffice.State || prev.state,
        country: 'India',
        addressLine1: addressLine1 || prev.addressLine1
      }));
      
      console.log('✅ Address auto-filled from pincode in order creation:', {
        city: postOffice.District,
        state: postOffice.State,
        addressLine1: addressLine1,
        postOfficeName: postOffice.Name,
        block: postOffice.Block,
        division: postOffice.Division
      });
    } else {
      console.log('❌ Pincode not found or invalid');
    }
  } catch (error) {
    console.log('❌ Pincode lookup failed:', error);
  } finally {
    setPincodeLoading(false);
  }
};

/**
 * Auto-populate city, state, country based on landmark or pincode
 */
export const autoPopulateAddress = (
  landmark: string,
  pincode: string,
  setNewOrder: (updater: (prev: OrderFormData) => OrderFormData) => void,
  handlePincodeLookup: (pincode: string) => Promise<void>
) => {
  // If pincode is 6 digits, use the enhanced pincode lookup
  if (pincode && pincode.length === 6) {
    handlePincodeLookup(pincode);
    return;
  }
  
  // Fallback to simple landmark mapping for non-pincode inputs
  if (landmark) {
    const landmarkKey = landmark.toLowerCase().trim();
    if (LANDMARK_MAP[landmarkKey]) {
      const address = LANDMARK_MAP[landmarkKey];
      setNewOrder(prev => ({
        ...prev,
        city: address.city,
        state: address.state,
        country: address.country
      }));
    }
  }
};

