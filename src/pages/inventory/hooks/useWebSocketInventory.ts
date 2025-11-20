// Custom hook for WebSocket inventory updates
import { useEffect } from 'react';
import { Product } from '../types/inventory.types';

interface UseWebSocketInventoryProps {
    isConnected: boolean;
    products: Product[];
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
    setTotalProducts: React.Dispatch<React.SetStateAction<number>>;
    setTotalStock: React.Dispatch<React.SetStateAction<number>>;
    setLowStockCount: React.Dispatch<React.SetStateAction<number>>;
    loadMetrics: () => Promise<void>;
}

export function useWebSocketInventory({
    isConnected,
    products,
    setProducts,
    setTotalProducts,
    setTotalStock,
    setLowStockCount,
    loadMetrics
}: UseWebSocketInventoryProps) {
    useEffect(() => {
        if (!isConnected) return;

        const handleInventoryUpdate = (data: any) => {
            if (data.productId) {
                setProducts(prevProducts => {
                    return prevProducts.map(product => {
                        if (product.product_id === data.productId) {
                            return {
                                ...product,
                                ...(data.quantity !== undefined && { quantity_available: data.quantity }),
                                ...(data.productName && { product_name: data.productName }),
                                ...(data.brand !== undefined && { brand: data.brand }),
                                ...(data.description !== undefined && { description: data.description }),
                                ...(data.reorderLevel !== undefined && { reorder_level: data.reorderLevel }),
                                ...(data.unitPrice !== undefined && { unit_price: data.unitPrice }),
                                ...(data.sellingPrice !== undefined && { selling_price: data.sellingPrice }),
                                ...(data.hsn_code !== undefined && { hsn_code: data.hsn_code }),
                                ...(data.gst_rate !== undefined && { gst_rate: data.gst_rate })
                            };
                        }
                        return product;
                    });
                });
                
                if (data.quantity !== undefined) {
                    setTotalStock(prevTotal => {
                        const oldProduct = products.find(p => p.product_id === data.productId);
                        const oldQuantity = oldProduct?.quantity_available || 0;
                        return prevTotal - oldQuantity + data.quantity;
                    });
                }
                
                setTimeout(() => {
                    loadMetrics();
                }, 1000);
            }
        };

        const handleInventoryProductAdded = (data: any) => {
            const newProduct: Product = {
                product_id: data.productId,
                product_name: data.productName,
                sku: data.sku,
                category: data.category || '',
                brand: data.brand || '',
                description: data.description || '',
                quantity_available: data.stock || 0,
                reorder_level: data.reorderLevel || 0,
                unit_price: data.unitPrice || 0,
                selling_price: data.sellingPrice || 0,
                is_low_stock: (data.stock || 0) <= (data.reorderLevel || 0),
                merchant_id: 0
            };
            
            setProducts(prevProducts => [newProduct, ...prevProducts]);
            setTotalProducts(prevTotal => prevTotal + 1);
            
            setTotalStock(prevTotal => prevTotal + (data.stock || 0));
            if (newProduct.is_low_stock) {
                setLowStockCount(prevCount => prevCount + 1);
            }
            
            setTimeout(() => {
                loadMetrics();
            }, 1000);
        };

        const handleInventoryPriceUpdate = (data: any) => {
            if (data.productId && data.unitPrice !== undefined) {
                setProducts(prevProducts => {
                    return prevProducts.map(product => {
                        if (product.product_id === data.productId) {
                            return {
                                ...product,
                                unit_price: data.unitPrice
                            };
                        }
                        return product;
                    });
                });
            }
        };

        const handleInventorySellingPriceUpdate = (data: any) => {
            if (data.productId && data.sellingPrice !== undefined) {
                setProducts(prevProducts => {
                    return prevProducts.map(product => {
                        if (product.product_id === data.productId) {
                            return {
                                ...product,
                                selling_price: data.sellingPrice
                            };
                        }
                        return product;
                    });
                });
            }
        };

        const socket = (window as any).io;
        if (socket && socket.connected) {
            socket.on('inventory-updated', handleInventoryUpdate);
            socket.on('inventory-product-added', handleInventoryProductAdded);
            socket.on('inventory-price-updated', handleInventoryPriceUpdate);
            socket.on('inventory-selling-price-updated', handleInventorySellingPriceUpdate);
            socket.on('inventory-stock-updated', handleInventoryUpdate);
            
            return () => {
                socket.off('inventory-updated', handleInventoryUpdate);
                socket.off('inventory-product-added', handleInventoryProductAdded);
                socket.off('inventory-price-updated', handleInventoryPriceUpdate);
                socket.off('inventory-selling-price-updated', handleInventorySellingPriceUpdate);
                socket.off('inventory-stock-updated', handleInventoryUpdate);
            };
        }
    }, [isConnected, products, setProducts, setTotalProducts, setTotalStock, setLowStockCount, loadMetrics]);
}

