import { API_BASE_URL } from '../../../config/api';
import type { Merchant } from '../types/publicCatalog.types';

export async function fetchMerchant(merchantId: string): Promise<Merchant | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/public/catalog/merchant/${merchantId}`);
    const data = await response.json();
    if (data.success) {
      return data.merchant;
    }
    return null;
  } catch (error) {
    console.error('Error fetching merchant:', error);
    return null;
  }
}

