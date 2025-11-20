import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../handlers/formHandlers';

interface ShareCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalogLink: string;
}

export const ShareCatalogModal: React.FC<ShareCatalogModalProps> = ({ isOpen, onClose, catalogLink }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    copyToClipboard(catalogLink, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Share Your Catalog</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Share this link with your customers to let them browse and order directly from your catalog.
        </p>

        {catalogLink ? (
          <>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={catalogLink}
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check size={18} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              Loading catalog link... Please wait.
            </p>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">How it works:</h3>
          <ul className="list-disc list-inside text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <li>Share this link via WhatsApp, email, or social media</li>
            <li>Customers can browse products without logging in</li>
            <li>They can add items to cart and place orders directly</li>
            <li>Orders will appear in your Orders dashboard</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

