import React from 'react';

interface ProgressModalProps {
  isOpen: boolean;
  title: string;
  progress: number; // 0-100
  currentItem: string;
  totalItems: number;
  processedItems: number;
  errors: string[];
  errorDetails?: string[];
  onClose: () => void;
  showSuccess?: boolean;
  successMessage?: string;
  isWebSocketConnected?: boolean;
}

const ProgressModal: React.FC<ProgressModalProps> = ({
  isOpen,
  title,
  progress,
  currentItem,
  totalItems,
  processedItems,
  errors,
  errorDetails = [],
  onClose,
  showSuccess = false,
  successMessage = "Upload completed successfully!",
  isWebSocketConnected = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {showSuccess ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-600 dark:text-green-400 font-medium mb-4">
              {successMessage}
            </p>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <p>Processed: {processedItems} of {totalItems} items</p>
              {errors && errors.length > 0 && (
                <p className="text-red-600 dark:text-red-400">Errors: {errors.length}</p>
              )}
            </div>
            
            {/* Show detailed errors if any */}
            {errorDetails && errorDetails.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                  Failed Items ({errorDetails.length}):
                </p>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                  <div className="space-y-1">
                    {errorDetails.slice(0, 10).map((error, index) => (
                      <p key={index} className="text-xs text-red-700 dark:text-red-300 break-words">
                        {error}
                      </p>
                    ))}
                    {errorDetails.length > 10 && (
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                        ... and {errorDetails.length - 10} more errors
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div>
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Progress</span>
                <span>{processedItems} / {totalItems}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                {Math.round(progress)}%
              </div>
            </div>

            {/* Current Item */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Currently processing:</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {currentItem || 'Preparing...'}
              </p>
            </div>

            {/* Errors */}
            {errors && errors.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                  Errors ({errors ? errors.length : 0}):
                </p>
                <div className="max-h-32 overflow-y-auto bg-red-50 dark:bg-red-900/20 p-2 rounded text-xs">
                  {errors && errors.slice(-5).map((error, index) => (
                    <p key={index} className="text-red-600 dark:text-red-400 mb-1">
                      {error}
                    </p>
                  ))}
                  {errors && errors.length > 5 && (
                    <p className="text-red-600 dark:text-red-400 text-xs">
                      ... and {errors.length - 5} more errors
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Loading Animation */}
            <div className="flex items-center justify-center mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                Processing...
              </span>
            </div>

            {/* WebSocket Status */}
            <div className="text-center mb-4">
              <span className={`text-xs px-2 py-1 rounded ${
                isWebSocketConnected 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              }`}>
                {isWebSocketConnected ? 'Real-time updates' : 'Fallback mode'}
              </span>
            </div>

            {/* Manual Close Button */}
            <div className="text-center">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-md transition-colors"
              >
                Close Modal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressModal;
