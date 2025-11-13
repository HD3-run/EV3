import React, { useState } from 'react';
import { Share2, X, Star, Trash2 } from 'lucide-react';
import { useAuthFetch } from '../hooks/useAuthFetch';
import { useProductCatalog } from './product-catalog/hooks/useProductCatalog';
import { useImageUpload } from './product-catalog/hooks/useImageUpload';
import { useProductHandlers } from './product-catalog/handlers/productHandlers';
import { useImageHandlers } from './product-catalog/handlers/imageHandlers';
import { handleInputChange } from './product-catalog/handlers/formHandlers';
import { useWebSocketCatalog } from './product-catalog/hooks/useWebSocketCatalog';
import { SearchToolbar } from './product-catalog/components/SearchToolbar';
import { ProductGrid } from './product-catalog/components/ProductGrid';
import { Pagination } from './product-catalog/components/Pagination';
import { ShareCatalogModal } from './product-catalog/modals/ShareCatalogModal';
import { ImageGallery } from './product-catalog/components/ImageGallery';
import { FormData, Product } from './product-catalog/types/catalog.types';
import { getDefaultFormData } from './product-catalog/utils/formUtils';
import { revokeImagePreview } from './product-catalog/utils/imageUtils';

const ProductCatalog: React.FC = () => {
  const authFetch = useAuthFetch();
  const {
    products,
    setProducts,
    categories,
    loading,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    pagination,
    setPagination,
    catalogLink,
    loadProducts,
  } = useProductCatalog();

  const {
    selectedImage,
    imagePreview,
    uploading,
    setUploading,
    handleImageSelect,
    clearImage,
  } = useImageUpload();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [formData, setFormData] = useState<FormData>(getDefaultFormData());

  const { handleSubmit, handleDeleteProduct, handleViewProduct, openEditModal } = useProductHandlers(authFetch);
  const { handleImageUpload, handleDeleteImage, handleSetPrimaryImage } = useImageHandlers(authFetch);

  // Use WebSocket hook for real-time stock updates
  useWebSocketCatalog({
    products,
    setProducts,
    loadProducts
  });

  const resetForm = () => {
    setFormData(getDefaultFormData());
    setSelectedProduct(null);
    clearImage();
  };

  const onProductSubmit = async (
    e: React.FormEvent,
    formData: FormData,
    selectedProduct: Product | null,
    selectedImage: File | null,
    isFeatured: boolean
  ) => {
    await handleSubmit(
      e,
      formData,
      selectedProduct,
      selectedImage,
      isFeatured,
      () => {
        setShowAddModal(false);
        resetForm();
        loadProducts();
      },
      async (productId, file, isPrimary, isFeatured) => {
        setUploading(true);
        try {
          await handleImageUpload(
            productId,
            file,
            isPrimary,
            isFeatured,
            () => {},
            (updatedProduct) => {
              if (viewProduct && viewProduct.product_id === productId) {
                setViewProduct(updatedProduct);
              }
              if (selectedProduct && selectedProduct.product_id === productId) {
                setSelectedProduct(updatedProduct);
              }
            }
          );
        } finally {
          setUploading(false);
        }
      }
    );
  };

  const onDeleteProduct = async (productId: number) => {
    await handleDeleteProduct(productId, () => {
      loadProducts();
    });
  };

  const onViewProduct = async (productId: number) => {
    await handleViewProduct(productId, (product) => {
      setViewProduct(product);
    });
  };

  const onEditProduct = async (product: Product) => {
    await openEditModal(product, (fullProduct, formData) => {
      setSelectedProduct(fullProduct);
      setFormData(formData);
      setShowAddModal(true);
    });
  };

  const onImageDelete = async (productId: number, imageId: number) => {
    await handleDeleteImage(
      productId,
      imageId,
      () => {
        loadProducts();
      },
      (updatedProduct) => {
        // Update viewProduct if it's the same product
        if (viewProduct && viewProduct.product_id === productId) {
          setViewProduct(updatedProduct);
        }
        // Update selectedProduct if it's the same product
        if (selectedProduct && selectedProduct.product_id === productId) {
          setSelectedProduct(updatedProduct);
        }
        // Update the product in the products list
        setProducts(prevProducts =>
          prevProducts.map(p =>
            p.product_id === productId ? updatedProduct : p
          )
        );
      }
    );
  };

  const onSetPrimary = async (productId: number, imageId: number) => {
    await handleSetPrimaryImage(
      productId,
      imageId,
      () => {
        loadProducts();
      },
      (updatedProduct) => {
        // Update viewProduct if it's the same product
        if (viewProduct && viewProduct.product_id === productId) {
          setViewProduct(updatedProduct);
        }
        // Update selectedProduct if it's the same product
        if (selectedProduct && selectedProduct.product_id === productId) {
          setSelectedProduct(updatedProduct);
        }
        // Update the product in the products list
        setProducts(prevProducts =>
          prevProducts.map(p =>
            p.product_id === productId ? updatedProduct : p
          )
        );
      }
    );
  };

  const onImageUploadInView = async (file: File) => {
    if (!viewProduct) return;
    const isPrimary = !viewProduct.images || viewProduct.images.length === 0;
    setUploading(true);
    try {
      await handleImageUpload(
        viewProduct.product_id,
        file,
        isPrimary,
        false,
        () => {},
        (updatedProduct) => {
          // Update viewProduct
          setViewProduct(updatedProduct);
          // Update selectedProduct if it's the same product
          if (selectedProduct && selectedProduct.product_id === updatedProduct.product_id) {
            setSelectedProduct(updatedProduct);
          }
          // Update the product in the products list so the card shows the new image
          setProducts(prevProducts =>
            prevProducts.map(p =>
              p.product_id === updatedProduct.product_id ? updatedProduct : p
            )
          );
        }
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Product Catalog
            </h1>
            <p className="text-gray-600 dark:text-gray-400">             
              You can share the catalog with your customers to let them browse and order directly from your catalog.
              Adding product in inventory will automatically update the catalog, viceversa.  We still expect you to visit the product added to this page to add the image for the product.
            </p>
          </div>
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Share2 size={20} />
            Share Catalog
          </button>
        </div>
      </div>

      <ShareCatalogModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        catalogLink={catalogLink}
      />

      <SearchToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categories={categories}
        onAddClick={() => {
          resetForm();
          setShowAddModal(true);
        }}
      />

      <ProductGrid
        products={products}
        loading={loading}
        onView={onViewProduct}
        onEdit={onEditProduct}
        onDelete={onDeleteProduct}
      />

      <Pagination
        pagination={pagination}
        onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
      />

      {/* Add/Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedProduct ? 'Edit Product' : 'Add New Product'}
                </h2>
                <button
                  onClick={() => {
                    if (imagePreview) {
                      revokeImagePreview(imagePreview);
                    }
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={(e) => onProductSubmit(e, formData, selectedProduct, selectedImage, formData.is_featured)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      name="product_name"
                      value={formData.product_name}
                      onChange={(e) => handleInputChange(e, setFormData)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      name="category_id"
                      value={formData.category_id}
                      onChange={(e) => handleInputChange(e, setFormData)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.category_id} value={cat.category_id}>
                          {cat.category_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Brand
                    </label>
                    <input
                      type="text"
                      name="brand"
                      value={formData.brand}
                      onChange={(e) => handleInputChange(e, setFormData)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Selling Price *
                    </label>
                    <input
                      type="number"
                      name="selling_price"
                      value={formData.selling_price}
                      onChange={(e) => handleInputChange(e, setFormData)}
                      required
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cost Price
                    </label>
                    <input
                      type="number"
                      name="cost_price"
                      value={formData.cost_price}
                      onChange={(e) => handleInputChange(e, setFormData)}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      GST Rate
                    </label>
                    <select
                      name="gst_rate"
                      value={formData.gst_rate}
                      onChange={(e) => handleInputChange(e, setFormData)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="0">0% GST</option>
                      <option value="5">5% GST</option>
                      <option value="12">12% GST</option>
                      <option value="18">18% GST (Default)</option>
                      <option value="28">28% GST</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      HSN Code
                    </label>
                    <input
                      type="text"
                      name="hsn_code"
                      value={formData.hsn_code}
                      onChange={(e) => handleInputChange(e, setFormData)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stock Quantity
                    </label>
                    <input
                      type="number"
                      name="stock_quantity"
                      value={formData.stock_quantity}
                      onChange={(e) => handleInputChange(e, setFormData)}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Reorder Level
                    </label>
                    <input
                      type="number"
                      name="reorder_level"
                      value={formData.reorder_level}
                      onChange={(e) => handleInputChange(e, setFormData)}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange(e, setFormData)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Existing Images (only in edit mode) */}
                {selectedProduct && selectedProduct.images && selectedProduct.images.length > 0 && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Existing Images
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {selectedProduct.images.map(image => (
                        <div key={image.image_id} className="relative group">
                          <img
                            src={image.image_url}
                            alt={image.alt_text || selectedProduct.product_name}
                            className="w-full h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                          />
                          {image.is_primary && (
                            <span className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                              Primary
                            </span>
                          )}
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!image.is_primary && (
                              <button
                                type="button"
                                onClick={() => onSetPrimary(selectedProduct.product_id, image.image_id)}
                                className="p-1 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                                title="Set as Primary"
                              >
                                <Star size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onImageDelete(selectedProduct.product_id, image.image_id)}
                              className="p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                              title="Delete Image"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {selectedProduct ? 'Upload New Image' : 'Product Image'}
                  </label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleImageSelect(file);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                    {imagePreview && (
                      <div className="mt-3 relative inline-block">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-32 h-32 object-cover rounded border border-gray-300 dark:border-gray-600"
                        />
                        <button
                          type="button"
                          onClick={() => clearImage()}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_featured"
                    checked={formData.is_featured}
                    onChange={(e) => handleInputChange(e, setFormData)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Mark as Featured Product
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Creating...' : selectedProduct ? 'Update Product' : 'Create Product'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (imagePreview) {
                        revokeImagePreview(imagePreview);
                      }
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Product Modal */}
      {viewProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {viewProduct.product_name}
                </h2>
                <button
                  onClick={() => setViewProduct(null)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Product Images */}
              <ImageGallery
                product={viewProduct}
                uploading={uploading}
                onUpload={onImageUploadInView}
                onSetPrimary={(imageId) => onSetPrimary(viewProduct.product_id, imageId)}
                onDelete={(imageId) => onImageDelete(viewProduct.product_id, imageId)}
              />

              {/* Product Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Basic Information</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">SKU:</span>
                      <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">{viewProduct.sku}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Category:</span>
                      <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                        {viewProduct.category_name || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Brand:</span>
                      <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                        {viewProduct.brand || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Pricing & Tax</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Selling Price:</span>
                      <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                        ₹{Number(viewProduct.selling_price || 0).toFixed(2)}
                      </span>
                    </div>
                    {viewProduct.cost_price && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Cost Price:</span>
                        <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                          ₹{Number(viewProduct.cost_price || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">GST Rate:</span>
                      <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                        {viewProduct.gst_rate || viewProduct.tax_rate || 0}%
                      </span>
                    </div>
                    {viewProduct.hsn_code && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">HSN Code:</span>
                        <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                          {viewProduct.hsn_code}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Stock Information</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total Stock:</span>
                      <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                        {viewProduct.total_stock}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Reorder Level:</span>
                      <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                        {viewProduct.reorder_level}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Status</h3>
                  <div className="space-y-2">
                    <div>
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        viewProduct.is_active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {viewProduct.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {viewProduct.is_featured && (
                      <div>
                        <span className="inline-block px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Featured Product
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {viewProduct.description && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Description</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{viewProduct.description}</p>
                </div>
              )}

              {viewProduct.tags && viewProduct.tags.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {viewProduct.tags.map(tag => (
                      <span
                        key={tag.tag_id}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full"
                      >
                        {tag.tag_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    onEditProduct(viewProduct);
                    setViewProduct(null);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit Product
                </button>
                <button
                  onClick={() => setViewProduct(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCatalog;
