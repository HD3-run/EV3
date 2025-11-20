// Add Product Modal Component
import { createPortal } from 'react-dom';
import { NewProduct, GstSuggestion } from '../types/inventory.types';
import { getGstRateFromHsn } from '../utils/gstUtils';

interface AddProductModalProps {
  show: boolean;
  newProduct: NewProduct;
  gstSuggestion: GstSuggestion | null;
  onProductChange: (product: NewProduct) => void;
  onGstSuggestionChange: (suggestion: GstSuggestion | null) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function AddProductModal({
  show,
  newProduct,
  gstSuggestion,
  onProductChange,
  onGstSuggestionChange,
  onSubmit,
  onClose
}: AddProductModalProps) {
  if (!show) return null;

  const handleHsnChange = (hsnValue: string) => {
    onProductChange({ ...newProduct, hsn_code: hsnValue });
    
    if (hsnValue.length >= 4) {
      const suggestedRate = getGstRateFromHsn(hsnValue);
      if (suggestedRate !== null) {
        onProductChange({ ...newProduct, hsn_code: hsnValue, gst_rate: suggestedRate });
        onGstSuggestionChange({ message: `GST rate auto-filled to ${suggestedRate}% based on HSN code`, type: 'success' });
        setTimeout(() => onGstSuggestionChange(null), 3000);
      }
    }
  };

  const handleGstRateChange = (selectedRate: number) => {
    onProductChange({ ...newProduct, gst_rate: selectedRate });
    
    if (newProduct.hsn_code && newProduct.hsn_code.length >= 4) {
      const suggestedRate = getGstRateFromHsn(newProduct.hsn_code);
      if (suggestedRate !== null && suggestedRate !== selectedRate) {
        onGstSuggestionChange({ 
          message: `Note: HSN code ${newProduct.hsn_code} typically has ${suggestedRate}% GST, but you selected ${selectedRate}%`, 
          type: 'warning' 
        });
        setTimeout(() => onGstSuggestionChange(null), 5000);
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Product</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product Name:</label>
            <input
              type="text"
              placeholder="Product Name"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newProduct.name}
              onChange={(e) => onProductChange({ ...newProduct, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category:</label>
            <input
              type="text"
              placeholder="Category"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newProduct.category}
              onChange={(e) => onProductChange({ ...newProduct, category: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Brand:</label>
            <input
              type="text"
              placeholder="Brand"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newProduct.brand}
              onChange={(e) => onProductChange({ ...newProduct, brand: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description:</label>
            <textarea
              placeholder="Description"
              rows={3}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              value={newProduct.description}
              onChange={(e) => onProductChange({ ...newProduct, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stock Quantity:</label>
            <input
              type="number"
              placeholder="Stock Quantity"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newProduct.stock || ''}
              onChange={(e) => onProductChange({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cost Price:</label>
            <input
              type="number"
              placeholder="Cost Price"
              step="0.01"
              min="0"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newProduct.unitPrice || ''}
              onChange={(e) => onProductChange({ ...newProduct, unitPrice: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selling Price:</label>
            <input
              type="number"
              placeholder="Selling Price"
              step="0.01"
              min="0"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newProduct.sellingPrice || ''}
              onChange={(e) => onProductChange({ ...newProduct, sellingPrice: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reorder Level:</label>
            <input
              type="number"
              placeholder="Reorder Level"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newProduct.reorderLevel || ''}
              onChange={(e) => onProductChange({ ...newProduct, reorderLevel: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">HSN Code (Optional):</label>
            <input
              type="text"
              placeholder="HSN Code (Optional)"
              maxLength={8}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newProduct.hsn_code || ''}
              onChange={(e) => handleHsnChange(e.target.value)}
            />
            {gstSuggestion && (
              <div className={`mt-2 p-2 rounded text-sm ${gstSuggestion.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                {gstSuggestion.message}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">GST Rate:</label>
            <select
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newProduct.gst_rate}
              onChange={(e) => handleGstRateChange(parseFloat(e.target.value))}
            >
              <option value="0">0% GST</option>
              <option value="5">5% GST</option>
              <option value="12">12% GST</option>
              <option value="18">18% GST (Default)</option>
              <option value="28">28% GST</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!newProduct.name}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Add Product
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

