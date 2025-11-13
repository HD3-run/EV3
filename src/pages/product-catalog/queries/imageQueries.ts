import { API_BASE_URL } from '../../../config/api';

export async function fetchMerchantInfo(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/merchant-info`, {
      credentials: 'include',
    });
    if (response.ok) {
      const data = await response.json();
      const baseUrl = window.location.origin;
      return `${baseUrl}/catalog/${data.merchant_id}`;
    }
    return null;
  } catch (error) {
    console.error('Error fetching merchant info:', error);
    return null;
  }
}

