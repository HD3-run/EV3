// TypeScript interfaces for inventory

export interface Product {
    product_id: number;
    product_name: string;
    sku: string;
    category: string;
    merchant_id: number;
    brand?: string;
    description?: string;
    quantity_available: number;
    reorder_level: number;
    is_low_stock: boolean;
    unit_price?: number;
    selling_price?: number;
    hsn_code?: string;
    gst_rate?: number;
}

export interface EditingPrice {
    productId: number;
    value: string;
    priceType?: 'cost' | 'selling'; // 'cost' for unit_price, 'selling' for selling_price
}

export interface NewProduct {
    name: string;
    category: string;
    brand: string;
    description: string;
    stock: number;
    reorderLevel: number;
    unitPrice: number;
    sellingPrice: number;
    hsn_code: string;
    gst_rate: number;
}

export interface ManualUpdateProduct {
    productId: number;
    productName: string;
    sku: string;
    brand: string;
    description: string;
    stock: number;
    reorderLevel: number;
    hsn_code: string;
    gst_rate: number;
}

export interface GstSuggestion {
    message: string;
    type: 'success' | 'warning';
}

