// Custom hook for employee inventory filtering
import { useMemo } from 'react';
import { Product } from '../types/employee-inventory.types';

export function useEmployeeInventoryFilters(products: Product[]) {
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(products.map((p) => p.category).filter((c) => !!c)));
    return uniqueCategories;
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.quantity_available <= p.reorder_level).length;
  }, [products]);

  const outOfStockProducts = useMemo(() => {
    return products.filter(p => p.quantity_available === 0).length;
  }, [products]);

  return {
    categories,
    lowStockProducts,
    outOfStockProducts
  };
}

