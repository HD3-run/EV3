import React, { useState } from 'react';
import { useRoute } from 'wouter';

// Import hooks
import { useCart } from './public-catalog/hooks/useCart';
import { useCatalogData } from './public-catalog/hooks/useCatalogData';
import { useCatalogFilters } from './public-catalog/hooks/useCatalogFilters';

// Import components
import { CatalogHeader } from './public-catalog/components/CatalogHeader';
import { CatalogFilters } from './public-catalog/components/CatalogFilters';
import { ProductsGrid } from './public-catalog/components/ProductsGrid';
import { Pagination } from './public-catalog/components/Pagination';
import { LoadingState } from './public-catalog/components/LoadingState';
import { EmptyState } from './public-catalog/components/EmptyState';
import { CartSidebar } from './public-catalog/components/CartSidebar';
import { CheckoutModal, initialCheckoutData } from './public-catalog/modals/CheckoutModal';
import { ProductDetailModal } from './public-catalog/modals/ProductDetailModal';

// Import handlers
import { handleCheckoutSubmit } from './public-catalog/handlers/checkoutHandlers';

// Import utils
import { getCartTotal } from './public-catalog/utils/cartUtils';

// Import types
import type { CheckoutData, Product } from './public-catalog/types/publicCatalog.types';

const PublicCatalog: React.FC = () => {
  const [, params] = useRoute('/catalog/:merchantId');
  const merchantId = params?.merchantId;

  // Filters hook
  const {
    searchTerm,
    selectedCategory,
    pagination,
    setSearchTerm,
    setSelectedCategory,
    setPagination: handlePageChangeFilter,
  } = useCatalogFilters();

  // Catalog data hook
  const {
    merchant,
    products,
    categories,
    loading,
    pagination: dataPagination,
  } = useCatalogData(merchantId, {
    searchTerm,
    selectedCategory,
    pagination,
  });

  // Use pagination from data hook when available
  const currentPagination = dataPagination.totalPages > 0 ? dataPagination : pagination;

  // Cart hook
  const {
    cart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
  } = useCart(merchantId, products);

  // Modal states
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutData>(initialCheckoutData);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Handle checkout
  const handleCheckout = () => {
    setShowCheckout(true);
    setShowCart(false);
  };

  // Handle checkout submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantId) return;

    setSubmittingOrder(true);
    await handleCheckoutSubmit(
      merchantId,
      cart,
      checkoutData,
      {
        onSuccess: (orderNumber) => {
          alert(`Order placed successfully! Order ID: ${orderNumber}`);
          clearCart();
          setShowCheckout(false);
          setShowCart(false);
          setCheckoutData(initialCheckoutData);
        },
        onError: (message) => {
          alert(message);
        },
        onClearCart: clearCart,
        onCloseModals: () => {
          setShowCheckout(false);
          setShowCart(false);
        },
        onResetForm: () => {
          setCheckoutData(initialCheckoutData);
        },
      }
    );
    setSubmittingOrder(false);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    handlePageChangeFilter(page, currentPagination.totalPages);
  };

  if (!merchantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Invalid Catalog Link</h1>
          <p className="text-gray-600 dark:text-gray-400">The catalog link you're trying to access is invalid.</p>
        </div>
      </div>
    );
  }

  if (loading && products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingState message="Loading catalog..." />
      </div>
    );
  }

  const cartTotal = getCartTotal(cart);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <CatalogHeader
        merchant={merchant}
        cart={cart}
        onCartClick={() => setShowCart(true)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <CatalogFilters
          searchTerm={searchTerm}
          selectedCategory={selectedCategory}
          categories={categories}
          onSearchChange={setSearchTerm}
          onCategoryChange={setSelectedCategory}
        />

        {loading ? (
          <LoadingState message="Loading products..." />
        ) : products.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <ProductsGrid 
              products={products} 
              onAddToCart={addToCart}
              onViewDetails={setSelectedProduct}
            />
            <Pagination
              pagination={currentPagination}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>

      <CheckoutModal
        isOpen={showCheckout}
        cartTotal={cartTotal}
        checkoutData={checkoutData}
        submittingOrder={submittingOrder}
        onClose={() => setShowCheckout(false)}
        onDataChange={setCheckoutData}
        onSubmit={handleSubmit}
      />

      <CartSidebar
        cart={cart}
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeFromCart}
        onCheckout={handleCheckout}
      />

      <ProductDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
      />
    </div>
  );
};

export default PublicCatalog;
