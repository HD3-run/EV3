// Custom hook for inventory filtering and sorting
import { useMemo } from 'react';
import { Product } from '../types/inventory.types';

export function useInventoryFilters(products: Product[]) {
    const categories = useMemo(() => {
        const uniqueCategories = [...new Set(products.map(product => product.category).filter(Boolean))];
        return uniqueCategories;
    }, [products]);

    return { categories };
}

