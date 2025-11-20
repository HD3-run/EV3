// Product-related handlers
import { getApiUrl } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import { NewProduct, ManualUpdateProduct, Product } from '../types/inventory.types';

export async function handleAddProduct(
    newProduct: NewProduct,
    setShowAddModal: (show: boolean) => void,
    setNewProduct: (product: NewProduct) => void,
    loadProducts: (page?: number) => Promise<void>,
    loadMetrics: () => Promise<void>,
    currentPage: number
): Promise<void> {
    try {
        const response = await fetch(getApiUrl('/api/inventory/add-product'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(newProduct)
        });

        if (response.ok) {
            await response.json();
            
            const addedProductInfo = { ...newProduct };
            
            setShowAddModal(false);
            setNewProduct({
                name: '',
                category: '',
                brand: '',
                description: '',
                stock: 0,
                reorderLevel: 0,
                unitPrice: 0,
                sellingPrice: 0,
                hsn_code: '',
                gst_rate: 18
            });

            await loadProducts();
            loadMetrics();

            // Find the newly added product to get its SKU
            const response2 = await fetch(`/api/inventory?limit=50&page=${currentPage}`, {
                credentials: 'include'
            });
            const data = await response2.json();
            
            if (!data.products || !Array.isArray(data.products)) {
                throw new Error('Invalid response format');
            }
            
            const newlyAdded = data.products.find((p: any) => 
                p.product_name === addedProductInfo.name && 
                p.category === addedProductInfo.category
            );

            setTimeout(() => {
                alert(`Product added successfully!\n\nProduct: ${addedProductInfo.name}\nCategory: ${addedProductInfo.category}\nStock: ${addedProductInfo.stock}\nPrice: ${formatCurrency(addedProductInfo.unitPrice)}${newlyAdded?.sku ? `\nSKU: ${newlyAdded.sku}` : ''}`);
            }, 100);
        } else {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            alert(`Failed to add product: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error adding product:', error);
        alert('Failed to add product: Network error');
    }
}

export async function handleManualUpdate(
    manualUpdateProduct: ManualUpdateProduct,
    setShowManualUpdateModal: (show: boolean) => void,
    setManualUpdateProduct: (product: ManualUpdateProduct) => void,
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>,
    loadMetrics: () => Promise<void>
): Promise<void> {
    try {
        const response = await fetch(`/api/inventory/${manualUpdateProduct.productId}/update`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                productName: manualUpdateProduct.productName,
                brand: manualUpdateProduct.brand,
                description: manualUpdateProduct.description,
                quantity: manualUpdateProduct.stock,
                reorderLevel: manualUpdateProduct.reorderLevel,
                hsn_code: manualUpdateProduct.hsn_code,
                gst_rate: manualUpdateProduct.gst_rate
            })
        });

        if (response.ok) {
            // Update local state immediately without reloading
            setProducts(prevProducts =>
                prevProducts.map(product =>
                    product.product_id === manualUpdateProduct.productId
                        ? {
                            ...product,
                            product_name: manualUpdateProduct.productName,
                            brand: manualUpdateProduct.brand,
                            description: manualUpdateProduct.description,
                            quantity_available: manualUpdateProduct.stock,
                            reorder_level: manualUpdateProduct.reorderLevel,
                            hsn_code: manualUpdateProduct.hsn_code,
                            gst_rate: manualUpdateProduct.gst_rate
                        }
                        : product
                )
            );
            
            // Update metrics in background without blocking
            loadMetrics().catch(() => {}); // Silently fail if metrics update fails
            
            // Close modal and reset form
            setShowManualUpdateModal(false);
            setManualUpdateProduct({
                productId: 0,
                productName: '',
                sku: '',
                brand: '',
                description: '',
                stock: 0,
                reorderLevel: 0,
                hsn_code: '',
                gst_rate: 18
            });
        } else {
            const errorData = await response.json();
            alert(`Failed to update product: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        alert('Failed to update product');
    }
}

