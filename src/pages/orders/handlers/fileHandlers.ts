// File upload handlers

import { getApiUrl } from '../../../config/api';
import { logActivity } from '../../../utils/activityLogger';
import { updateProcessingErrors } from '../utils/clearProcessingErrors';

export interface FileUploadCallbacks {
  setCurrentUploadId: (id: string | null) => void;
  setProcessingErrors: React.Dispatch<React.SetStateAction<string[]>>;
  loadOrdersWrapper: () => Promise<void>;
  loadTotalOrders: () => Promise<void>;
}

/**
 * Handle CSV file upload
 */
export async function handleFileUpload(
  file: File,
  callbacks: FileUploadCallbacks
): Promise<void> {
  // Generate uploadId before starting upload for progress tracking
  const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log('🔄 Setting uploadId for Orders CSV upload:', uploadId);
  callbacks.setCurrentUploadId(uploadId);
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('uploadId', uploadId);

  try {
    const response = await fetch(getApiUrl('/api/orders/upload-csv'), {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    const result = await response.json();

    if (response.ok) {
      // Store processing errors for viewing
      if (result.errorDetails && result.errorDetails.length > 0) {
        updateProcessingErrors(result.errorDetails, callbacks.setProcessingErrors);
      }
      
      // Reload orders since CSV upload affects multiple orders
      await callbacks.loadOrdersWrapper();
      await callbacks.loadTotalOrders();
      
      // Show success message if no progress tracking
      if (!result.uploadId) {
        alert(`${result.message}\n\nCreated: ${result.created} orders\nErrors: ${result.errors}`);
      }
    } else {
      throw new Error(result.message || 'Upload failed');
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Network error');
  }

  logActivity("File uploaded", { fileName: file.name, fileSize: file.size });
}

