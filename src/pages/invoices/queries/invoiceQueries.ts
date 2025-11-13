// API query functions for invoices

import { getApiUrl } from '../../../config/api';
import type { Invoice } from '../types/invoice.types';

export interface LoadInvoicesParams {
  page: number;
  limit: number;
  searchTerm?: string;
  filterStatus?: string;
}

export interface LoadInvoicesResult {
  invoices: Invoice[];
  total: number;
  totalPages: number;
}

/**
 * Load invoices with pagination and filtering
 */
export const loadInvoices = async (
  params: LoadInvoicesParams
): Promise<LoadInvoicesResult> => {
  try {
    const queryParams = new URLSearchParams({
      page: params.page.toString(),
      limit: params.limit.toString()
    });
    
    if (params.searchTerm) {
      queryParams.append('search', params.searchTerm);
    }
    
    if (params.filterStatus && params.filterStatus !== 'all') {
      queryParams.append('status', params.filterStatus);
    }
    
    const response = await fetch(getApiUrl(`/api/invoices?${queryParams}`), {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        invoices: data.invoices || [],
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      };
    }
    
    return {
      invoices: [],
      total: 0,
      totalPages: 0
    };
  } catch (error) {
    console.error('Failed to load invoices:', error);
    return {
      invoices: [],
      total: 0,
      totalPages: 0
    };
  }
};

