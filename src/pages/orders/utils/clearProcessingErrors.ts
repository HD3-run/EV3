// Utility functions for processing errors management

/**
 * Clear processing errors from state and localStorage
 */
export const clearProcessingErrors = (
  setProcessingErrors: (errors: string[]) => void,
  setShowErrorsModal: (show: boolean) => void
) => {
  setProcessingErrors([]);
  localStorage.removeItem('orders-processing-errors');
  setShowErrorsModal(false); // Close modal when errors are cleared
};

/**
 * Update processing errors and save to localStorage
 */
export const updateProcessingErrors = (
  errors: string[],
  setProcessingErrors: (errors: string[]) => void
) => {
  setProcessingErrors(errors);
  if (errors.length > 0) {
    localStorage.setItem('orders-processing-errors', JSON.stringify(errors));
  } else {
    localStorage.removeItem('orders-processing-errors');
  }
};

/**
 * Load processing errors from localStorage
 */
export const loadProcessingErrors = (): string[] => {
  const savedErrors = localStorage.getItem('orders-processing-errors');
  return savedErrors ? JSON.parse(savedErrors) : [];
};

