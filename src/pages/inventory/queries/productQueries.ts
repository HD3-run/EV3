// API query functions for products
import { getApiUrl } from '../../../config/api';
import { Product } from '../types/inventory.types';

export interface LoadProductsParams {
    page: number;
    searchTerm?: string;
    categoryFilter?: string;
    stockStatusFilter?: string;
}

export interface LoadProductsResponse {
    products: Product[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export async function loadProducts(params: LoadProductsParams): Promise<LoadProductsResponse> {
    const { page, searchTerm, categoryFilter, stockStatusFilter } = params;
    
    const urlParams = new URLSearchParams({
        limit: '50',
        page: page.toString()
    });
    
    if (searchTerm) {
        urlParams.append('search', searchTerm);
    }
    
    if (categoryFilter && categoryFilter !== 'all') {
        urlParams.append('category', categoryFilter);
    }
    
    if (stockStatusFilter && stockStatusFilter !== 'all') {
        urlParams.append('stockStatus', stockStatusFilter);
    }
    
    const response = await fetch(`/api/inventory?${urlParams.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error('Failed to load products');
    }

    const data = await response.json();

    // Normalize products
    const normalizedProducts = (data.products || []).map((product: any): Product => ({
        ...product,
        product_name: product.product_name || product.name || '',
        sku: product.sku || '',
        category: product.category || '',
        quantity_available: product.quantity_available || 0,
        reorder_level: product.reorder_level || 0,
        is_low_stock: product.is_low_stock || false,
        unit_price: product.unit_price || 0,
        selling_price: product.selling_price || 0,
        gst_rate: product.gst_rate !== undefined && product.gst_rate !== null 
            ? (typeof product.gst_rate === 'string' ? parseFloat(product.gst_rate) : product.gst_rate)
            : undefined
    }));

    return {
        products: normalizedProducts,
        pagination: data.pagination || {
            page: 1,
            limit: 50,
            total: 0,
            totalPages: 0
        }
    };
}

export interface MetricsData {
    totalStock: number;
    lowStockCount: number;
}

export async function loadMetrics(): Promise<MetricsData> {
    const response = await fetch(getApiUrl('/api/inventory?limit=50000&page=1'), {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error('Failed to load metrics');
    }

    const data = await response.json();
    
    if (data.products && Array.isArray(data.products)) {
        const allProducts = data.products.map((product: any): Product => ({
            ...product,
            product_name: product.product_name || product.name || '',
            sku: product.sku || '',
            category: product.category || '',
            quantity_available: product.quantity_available || 0,
            reorder_level: product.reorder_level || 0,
            is_low_stock: product.is_low_stock || false,
            unit_price: product.unit_price || 0,
            selling_price: product.selling_price || 0,
            gst_rate: product.gst_rate !== undefined && product.gst_rate !== null 
                ? (typeof product.gst_rate === 'string' ? parseFloat(product.gst_rate) : product.gst_rate)
                : undefined
        }));

        const totalStock = allProducts.reduce((sum: number, product: Product) => 
            sum + (product.quantity_available || 0), 0
        );
        const lowStockCount = allProducts.filter((product: Product) => product.is_low_stock).length;
        
        return { totalStock, lowStockCount };
    }

    return { totalStock: 0, lowStockCount: 0 };
}

