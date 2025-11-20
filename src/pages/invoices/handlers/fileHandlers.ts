// File upload handlers for invoices

import { getApiUrl } from '../../../config/api';

export interface FileUploadCallbacks {
  setCurrentUploadId: (id: string | null) => void;
  loadInvoices: () => Promise<void>;
}

/**
 * Handle CSV file upload for invoices
 */
export async function handleFileUpload(
  file: File,
  callbacks: FileUploadCallbacks
): Promise<void> {
  // Generate uploadId before starting upload for progress tracking
  const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log('🔄 Setting uploadId for Invoices CSV upload:', uploadId);
  callbacks.setCurrentUploadId(uploadId);
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('uploadId', uploadId); // Send uploadId to backend
  
  try {
    const response = await fetch(getApiUrl('/api/invoices/upload-csv'), {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok) {
      // Reload invoices since CSV upload affects multiple invoices
      await callbacks.loadInvoices();
      
      // Show success message if no progress tracking
      if (!result.uploadId) {
        alert(`${result.message}\n\nCreated: ${result.created} invoices`);
      }
    } else {
      throw new Error(result.message || 'Upload failed');
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Network error');
  }
}

