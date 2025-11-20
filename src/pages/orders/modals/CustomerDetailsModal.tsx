// Customer Details Modal Component

import { createPortal } from 'react-dom';

interface CustomerDetails {
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  pincode?: string;
  address_line1?: string;
  address_line2?: string;
  landmark?: string;
  delivery_note?: string;
  state_code?: string;
  gst_number?: string;
}

interface CustomerDetailsModalProps {
  show: boolean;
  customerDetails: CustomerDetails | null;
  onClose: () => void;
}

export default function CustomerDetailsModal({
  show,
  customerDetails,
  onClose
}: CustomerDetailsModalProps) {
  if (!show || !customerDetails) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Customer Details</h3>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
              <p className="text-sm text-gray-900 dark:text-white">{customerDetails.name || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phone Number</label>
              <p className="text-sm text-gray-900 dark:text-white">{customerDetails.phone || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
              <p className="text-sm text-gray-900 dark:text-white">{customerDetails.email || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">City</label>
              <p className="text-sm text-gray-900 dark:text-white">{customerDetails.city || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">State</label>
              <p className="text-sm text-gray-900 dark:text-white">{customerDetails.state || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pincode</label>
              <p className="text-sm text-gray-900 dark:text-white">{customerDetails.pincode || 'N/A'}</p>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Address Line 1</label>
            <p className="text-sm text-gray-900 dark:text-white">{customerDetails.address_line1 || 'N/A'}</p>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Address Line 2</label>
            <p className="text-sm text-gray-900 dark:text-white">{customerDetails.address_line2 || 'N/A'}</p>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Landmark</label>
            <p className="text-sm text-gray-900 dark:text-white">{customerDetails.landmark || 'N/A'}</p>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Delivery Note</label>
            <p className="text-sm text-gray-900 dark:text-white">{customerDetails.delivery_note || 'N/A'}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">State Code</label>
              <p className="text-sm text-gray-900 dark:text-white">{customerDetails.state_code || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">GST Number</label>
              <p className="text-sm text-gray-900 dark:text-white font-mono">{customerDetails.gst_number || 'N/A'}</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

