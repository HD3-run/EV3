// File upload handlers
import { getApiUrl } from '../../../config/api';

export async function handleFileUpload(
    file: File,
    setCurrentUploadId: (id: string | null) => void,
    updateProcessingErrors: (errors: string[]) => void,
    loadProducts: () => Promise<void>,
    loadMetrics: () => Promise<void>
): Promise<void> {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentUploadId(uploadId);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadId', uploadId);

    try {
        const response = await fetch(getApiUrl('/api/inventory/upload-csv'), {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            if (result.errorDetails && result.errorDetails.length > 0) {
                updateProcessingErrors(result.errorDetails);
            }
            
            await loadProducts();
            loadMetrics();
            
            if (!result.uploadId) {
                alert(`${result.message}\n\nCreated: ${result.created} products`);
            }
        } else {
            throw new Error(result.message || 'Upload failed');
        }
    } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Network error');
    }
}

export async function handleCSVUpload(
    file: File,
    setCurrentUploadId: (id: string | null) => void,
    loadProducts: () => Promise<void>,
    loadMetrics: () => Promise<void>
): Promise<void> {
    const uploadId = `stock_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentUploadId(uploadId);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadId', uploadId);

    try {
        const response = await fetch(getApiUrl('/api/inventory/update-stock-csv'), {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            await loadProducts();
            loadMetrics();
            
            if (!result.uploadId) {
                alert(`${result.message}\n\nUpdated: ${result.updated} products`);
            }
        } else {
            throw new Error(result.message || 'Stock update failed');
        }
    } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Network error');
    }
}

