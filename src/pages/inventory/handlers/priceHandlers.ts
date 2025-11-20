// Price-related handlers
import { EditingPrice, Product } from '../types/inventory.types';

export function handlePriceEdit(
    productId: number,
    currentPrice: number,
    setEditingPrice: (price: EditingPrice | null) => void,
    priceType: 'cost' | 'selling' = 'cost'
): void {
    setEditingPrice({ productId, value: currentPrice?.toString() || '0', priceType });
}

export async function handlePriceSave(
    productId: number,
    editingPrice: EditingPrice | null,
    setEditingPrice: (price: EditingPrice | null) => void,
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>
): Promise<void> {
    if (!editingPrice) return;

    const newPrice = parseFloat(editingPrice.value);
    if (isNaN(newPrice) || newPrice < 0) {
        alert('Please enter a valid price');
        return;
    }

    const isSellingPrice = editingPrice.priceType === 'selling';

    try {
        const endpoint = isSellingPrice 
            ? `/api/inventory/${productId}/selling-price`
            : `/api/inventory/${productId}/price`;
        const body = isSellingPrice
            ? { sellingPrice: newPrice }
            : { unitPrice: newPrice };

        const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        if (response.ok) {
            // Update local state directly instead of reloading all products
            setProducts(prevProducts =>
                prevProducts.map(product =>
                    product.product_id === productId
                        ? { ...product, ...(isSellingPrice ? { selling_price: newPrice } : { unit_price: newPrice }) }
                        : product
                )
            );
            setEditingPrice(null);
        } else {
            alert(`Failed to update ${isSellingPrice ? 'selling' : 'cost'} price`);
        }
    } catch (error) {
        alert(`Failed to update ${isSellingPrice ? 'selling' : 'cost'} price`);
    }
}

export function handlePriceCancel(
    setEditingPrice: (price: EditingPrice | null) => void
): void {
    setEditingPrice(null);
}

