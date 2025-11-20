// Processing Errors Modal Component
import { createPortal } from 'react-dom';

interface ProcessingErrorsModalProps {
  show: boolean;
  errors: string[];
  onClear: () => void;
  onClose: () => void;
}

export default function ProcessingErrorsModal({
  show,
  errors,
  onClear,
  onClose
}: ProcessingErrorsModalProps) {
  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Processing Errors ({errors.length})
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClear}
              className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors flex items-center space-x-1"
              title="Clear all errors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear</span>
            </button>
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
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md">
            <div className="space-y-2">
              {errors.map((error, index) => (
                <div key={`error-${index}-${error.slice(0, 20)}`} className="text-sm text-red-700 dark:text-red-300 break-words border-b border-red-200 dark:border-red-800 pb-2 last:border-b-0">
                  <span className="font-medium text-red-800 dark:text-red-200">#{index + 1}:</span> {error}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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

