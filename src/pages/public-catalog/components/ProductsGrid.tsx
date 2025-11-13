import React from 'react';
import type { Product } from '../types/publicCatalog.types';
import { ProductCard } from './ProductCard';

interface ProductsGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
}

export const ProductsGrid: React.FC<ProductsGridProps> = ({ products, onAddToCart, onViewDetails }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map(product => (
        <ProductCard
          key={product.product_id}
          product={product}
          onAddToCart={onAddToCart}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  );
};

