// Add Order Modal Component

import { createPortal } from 'react-dom';
import type { OrderFormData, FormErrors, Product } from '../types/order.types';

interface AddOrderModalProps {
  show: boolean;
  newOrder: OrderFormData;
  formErrors: FormErrors;
  products: Product[];
  manualProductId: string;
  productIdError: string;
  isValidatingProductId: boolean;
  pincodeLoading: boolean;
  onOrderChange: (order: OrderFormData) => void;
  onManualProductIdChange: (value: string) => void;
  onProductDropdownChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onAutoPopulateAddress: (landmark: string, pincode: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function AddOrderModal({
  show,
  newOrder,
  formErrors,
  products,
  manualProductId,
  productIdError,
  isValidatingProductId,
  pincodeLoading,
  onOrderChange,
  onManualProductIdChange,
  onProductDropdownChange,
  onPhoneChange,
  onEmailChange,
  onAutoPopulateAddress,
  onSubmit,
  onClose
}: AddOrderModalProps) {
  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Order</h3>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer Name:</label>
            <input
              type="text"
              placeholder="Customer Name"
              name="customer_name"
              className={`w-full p-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                formErrors.customerName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              value={newOrder.customerName}
              onChange={(e) => onOrderChange({...newOrder, customerName: e.target.value})}
            />
            {formErrors.customerName && (
              <p className="text-red-500 text-sm mt-1">{formErrors.customerName}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer Phone:</label>
            <input
              type="tel"
              placeholder="Customer Phone"
              name="customer_phone"
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              title="Please enter a valid 10-digit Indian phone number starting with 6, 7, 8, or 9"
              className={`w-full p-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                formErrors.customerPhone ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              value={newOrder.customerPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
            />
            {formErrors.customerPhone && (
              <p className="text-red-500 text-sm mt-1">{formErrors.customerPhone}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer Email:</label>
            <input
              type="email"
              placeholder="Customer Email"
              name="customer_email"
              className={`w-full p-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                formErrors.customerEmail ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              value={newOrder.customerEmail}
              onChange={(e) => onEmailChange(e.target.value)}
            />
            {formErrors.customerEmail && (
              <p className="text-red-500 text-sm mt-1">{formErrors.customerEmail}</p>
            )}
          </div>
          {/* Detailed Address Fields - required for all orders for proper GST calculation */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Address Details</h4>
            
            {/* Address Line 1 - Required */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address Line 1:</label>
              <input
                type="text"
                placeholder="Address Line 1 *"
                name="address_line1"
                className={`w-full p-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  formErrors.addressLine1 ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                value={newOrder.addressLine1}
                onChange={(e) => onOrderChange({...newOrder, addressLine1: e.target.value})}
              />
              {formErrors.addressLine1 && (
                <p className="text-red-500 text-sm mt-1">{formErrors.addressLine1}</p>
              )}
            </div>

            {/* Address Line 2 - Optional */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address Line 2 (Optional):</label>
              <input
                type="text"
                placeholder="Address Line 2 (Optional)"
                name="address_line2"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newOrder.addressLine2}
                onChange={(e) => onOrderChange({...newOrder, addressLine2: e.target.value})}
              />
            </div>

            {/* Landmark */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Landmark:</label>
              <input
                type="text"
                placeholder="Landmark"
                name="landmark"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newOrder.landmark}
                onChange={(e) => {
                  const landmark = e.target.value;
                  onOrderChange({...newOrder, landmark});
                  onAutoPopulateAddress(landmark, newOrder.pincode);
                }}
              />
            </div>

            {/* City, State, Pincode, Country in a grid */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">City:</label>
                <input
                  type="text"
                  placeholder="City *"
                  name="city"
                  className={`w-full p-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    formErrors.city ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  value={newOrder.city}
                  onChange={(e) => onOrderChange({...newOrder, city: e.target.value})}
                />
                {formErrors.city && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.city}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">State:</label>
                <input
                  type="text"
                  placeholder="State *"
                  name="state"
                  className={`w-full p-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    formErrors.state ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  value={newOrder.state}
                  onChange={(e) => onOrderChange({...newOrder, state: e.target.value})}
                />
                {formErrors.state && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.state}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pincode:</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Pincode *"
                    name="pincode"
                    className={`w-full p-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                      formErrors.pincode ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    value={newOrder.pincode}
                    onChange={(e) => {
                      const pincode = e.target.value;
                      onOrderChange({...newOrder, pincode});
                      onAutoPopulateAddress(newOrder.landmark, pincode);
                    }}
                  />
                  {pincodeLoading && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                {formErrors.pincode && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.pincode}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Country:</label>
                <input
                  type="text"
                  placeholder="Country"
                  name="country"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={newOrder.country}
                  onChange={(e) => onOrderChange({...newOrder, country: e.target.value})}
                />
              </div>
            </div>

            {/* Alternate Phone */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Alternate Phone (Optional):</label>
              <input
                type="tel"
                placeholder="Alternate Phone (Optional)"
                name="alternate_phone"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                title="Please enter a valid 10-digit Indian phone number starting with 6, 7, 8, or 9"
                className={`w-full p-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  formErrors.alternatePhone ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                value={newOrder.alternatePhone}
                onChange={(e) => {
                  // Only allow digits and limit to 10 characters
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                  onOrderChange({...newOrder, alternatePhone: digitsOnly});
                }}
              />
              {formErrors.alternatePhone && (
                <p className="text-red-500 text-sm mt-1">{formErrors.alternatePhone}</p>
              )}
            </div>

            {/* Delivery Note */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Delivery Note (Optional):</label>
              <textarea
                placeholder="Delivery Note (Optional)"
                name="delivery_note"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={2}
                value={newOrder.deliveryNote}
                onChange={(e) => onOrderChange({...newOrder, deliveryNote: e.target.value})}
              />
            </div>

            {/* Customer State Code */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer State Code (Optional):</label>
              <input
                type="text"
                placeholder="Customer State Code (Optional)"
                name="state_code"
                maxLength={2}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newOrder.state_code}
                onChange={(e) => onOrderChange({...newOrder, state_code: e.target.value})}
              />
              <p className="text-xs text-gray-500 mt-1">2-digit state code (e.g., 19 for West Bengal)</p>
            </div>

            {/* Customer GST Number */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer GST Number (Optional):</label>
              <input
                type="text"
                placeholder="Customer GST Number (Optional)"
                name="gst_number"
                maxLength={15}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newOrder.gst_number}
                onChange={(e) => onOrderChange({...newOrder, gst_number: e.target.value})}
              />
              <p className="text-xs text-gray-500 mt-1">15-character GST number (e.g., 22AAAAA0000A1Z5)</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product Selection:</label>
            
            {/* Dropdown Selection */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Select from dropdown:</label>
              <select
                name="product_selection"
                className={`w-full p-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  formErrors.productName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                value={newOrder.productId}
                onChange={(e) => onProductDropdownChange(e.target.value)}
              >
                <option value="">Select a product from inventory</option>
                {products.map(product => (
                  <option key={product.product_id} value={product.product_id}>
                    {product.product_name} (ID: {product.product_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Manual Product ID Input */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Or enter Product ID manually:</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="Enter Product ID (e.g., 1049112)"
                  className={`w-full p-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    productIdError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  value={manualProductId}
                  onChange={(e) => onManualProductIdChange(e.target.value)}
                  disabled={isValidatingProductId}
                />
                {isValidatingProductId && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              {productIdError && (
                <p className="text-red-500 text-sm mt-1">{productIdError}</p>
              )}
            </div>

            {/* Selected Product Display */}
            {newOrder.productName && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Selected:</strong> {newOrder.productName} (ID: {newOrder.productId})
                </p>
                <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                  Unit Price: ₹{newOrder.unitPrice}
                </p>
              </div>
            )}

            {formErrors.productName && (
              <p className="text-red-500 text-sm mt-1">{formErrors.productName}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantity:
            </label>
            <input
              type="number"
              placeholder="Enter quantity"
              name="quantity"
              min="1"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newOrder.quantity}
              onChange={(e) => onOrderChange({...newOrder, quantity: parseInt(e.target.value) || 1})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Unit Price:
            </label>
            <input
              type="number"
              placeholder="Enter unit price"
              name="unit_price"
              step="0.01"
              min="0"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newOrder.unitPrice}
              onChange={(e) => onOrderChange({...newOrder, unitPrice: parseFloat(e.target.value) || 0})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Order Source:
            </label>
            <select
              name="order_source"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newOrder.orderSource}
              onChange={(e) => onOrderChange({...newOrder, orderSource: e.target.value})}
            >
              <option value="Manual">Manual</option>
              <option value="Phone">Phone</option>
              <option value="Email">Email</option>
              <option value="Website">Website</option>
              <option value="WhatsApp">WhatsApp</option>
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
            disabled={!newOrder.customerName || (!newOrder.productName && !newOrder.productId) || !!productIdError || isValidatingProductId}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            title={`Customer: ${newOrder.customerName || 'empty'}, Product: ${newOrder.productName || newOrder.productId || 'empty'}`}
          >
            Add Order
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

