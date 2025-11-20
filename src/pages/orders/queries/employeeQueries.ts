// Employee-related query functions

import { getApiUrl } from '../../../config/api';

/**
 * Load employees list (only for admin users)
 */
export const loadEmployees = async (userRole: string): Promise<any[]> => {
  // Only load employees if user is admin
  if (userRole !== 'admin') {
    return [];
  }
  
  try {
    const response = await fetch(getApiUrl('/api/users'), {
      credentials: 'include'
    });
    if (response.ok) {
      const data = await response.json();
      return data.users.filter((user: any) => user.role !== 'admin');
    }
    return [];
  } catch (error) {
    console.error('Failed to load employees');
    return [];
  }
};

