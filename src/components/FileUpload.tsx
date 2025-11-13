import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import ProgressModal from './ProgressModal';
import { useWebSocket } from '../context/WebSocketContext';

interface FileUploadProps {
  onFileUpload: (file: File) => Promise<void>; // Changed to return Promise
  acceptedFileTypes?: Record<string, string[]>;
  label?: string;
  maxSize?: number;
  onError?: (error: string) => void;
  loading?: boolean;
  buttonLabel?: string; // New prop for button label
  showProgress?: boolean; // New prop to enable progress tracking
  uploadId?: string; // Upload ID for tracking
  onProcessingErrors?: (errors: string[]) => void; // New prop for processing errors
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  acceptedFileTypes = {
    'text/csv': ['.csv'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls']
  },
  label = 'Drag & drop files here, or click to select files',
  maxSize = 8 * 1024 * 1024, // 8MB default
  onError,
  loading = false,
  buttonLabel, // Destructure buttonLabel here
  showProgress = false,
  uploadId,
  onProcessingErrors
}) => {
  const [error, setError] = useState<string | null>(null);
  const [showDropzone, setShowDropzone] = useState<boolean>(false); // New state to control dropzone visibility
  const dropzoneRef = useRef<HTMLDivElement>(null); // Ref for the dropzone container
  
  // Progress tracking state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState('');
  const [totalItems, setTotalItems] = useState(0);
  const [processedItems, setProcessedItems] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  
  const { onProgressEvent, offProgressEvent, isConnected, ensureConnection, checkWebSocketServerStatus } = useWebSocket();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropzoneRef.current && !dropzoneRef.current.contains(event.target as Node)) {
        setShowDropzone(false);
      }
    };

    if (showDropzone) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropzone]);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      let errorMessage = 'File upload failed';
      
      if (rejection.errors) {
        const error = rejection.errors[0];
        if (error.code === 'file-too-large') {
          errorMessage = `File is too large. Maximum size is ${(maxSize / 1024 / 1024).toFixed(1)}MB`;
        } else if (error.code === 'file-invalid-type') {
          const allowedTypes = Object.values(acceptedFileTypes).flat().join(', ');
          errorMessage = `Invalid file type. Allowed types: ${allowedTypes}`;
        }
      }
      
      setError(errorMessage);
      onError?.(errorMessage);
      return;
    }
    
    if (acceptedFiles.length > 0) {
      // Reset progress state
      if (showProgress) {
        setProgress(0);
        setCurrentItem('');
        setTotalItems(0);
        setProcessedItems(0);
        setErrors([]);
        setCompleted(false);
        setSuccessMessage('');
        setUploadStartTime(Date.now());
        setShowProgressModal(true);
        
        // Ensure WebSocket connection is active before starting upload
        console.log('🔧 Ensuring WebSocket connection before upload...');
        ensureConnection();
        
        // Check WebSocket server status
        checkWebSocketServerStatus();
      }
      
      // Handle upload with fallback completion
      onFileUpload(acceptedFiles[0]).then(() => {
        // If WebSocket didn't work, close modal after upload completes
        if (showProgress && !completed) {
          setTimeout(() => {
            // Only set completion if we haven't received any progress updates
            if (progress === 0 && totalItems === 0) {
              setCompleted(true);
              setProgress(100);
              setSuccessMessage('Upload completed successfully!');
              setCurrentItem('Upload completed');
            }
          }, 2000); // Longer delay to allow WebSocket events to arrive first
        }
      }).catch((error) => {
        if (showProgress) {
          setCompleted(true);
          setProgress(100);
          setSuccessMessage(`Upload failed: ${error.message || 'Unknown error'}`);
          setCurrentItem('Upload failed');
        }
      });
    }
  }, [onFileUpload, maxSize, acceptedFileTypes, onError, showProgress]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple: false,
    maxSize,
    disabled: loading
  });
  
  const allowedExtensions = Object.values(acceptedFileTypes).flat().join(', ');

  // WebSocket progress tracking (if enabled)
  useEffect(() => {
    if (!showProgress || !uploadId) return;

    const handleProgressEvent = (event: any) => {
      if (event.data.uploadId === uploadId) {
        setProgress(event.data.progress);
        setCurrentItem(event.data.currentItem);
        setTotalItems(event.data.totalItems);
        setProcessedItems(event.data.processedItems);
        setErrors(event.data.errors || []);
        setErrorDetails(event.data.errorDetails || []);
        setCompleted(event.data.completed || event.data.status === 'completed');
        if (event.data.successMessage) {
          setSuccessMessage(event.data.successMessage);
        }
        
        // Pass error details to parent component
        if (event.data.errorDetails && event.data.errorDetails.length > 0 && onProcessingErrors) {
          onProcessingErrors(event.data.errorDetails);
        }
      } else {
        console.log('❌ Progress event uploadId does not match current uploadId');
        console.log('Expected:', uploadId);
        console.log('Received:', event.data.uploadId);
      }
    };

    onProgressEvent(handleProgressEvent);

    return () => {
      offProgressEvent(handleProgressEvent);
    };
  }, [showProgress, uploadId, onProgressEvent, offProgressEvent]);

  // Fallback timeout to close modal if no progress updates received
  useEffect(() => {
    if (!showProgressModal || !uploadStartTime) return;

    const timeout = setTimeout(() => {
      // If no progress has been made after 30 seconds, assume completion
      if (progress === 0 && !completed) {
        setCompleted(true);
        setProgress(100);
        setSuccessMessage('Upload completed (timeout fallback)');
        setCurrentItem('Upload completed');
      }
    }, 30000); // 30 second timeout

    return () => clearTimeout(timeout);
  }, [showProgressModal, uploadStartTime, progress, completed]);

  // No simulated progress - rely on WebSocket for real-time updates

  return (
    <div className="space-y-2">
      {buttonLabel ? (
        <button
          type="button"
          onClick={() => {
            setShowDropzone(true); // Only show dropzone when button is clicked
          }}
          className={`p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors w-full flex items-center justify-center space-x-2
            ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span>Uploading...</span>
            </div>
          ) : (
            <>
              <span>{buttonLabel}</span>
            </>
          )}
        </button>
      ) : null}

      {/* Conditionally render the dropzone */}
      {showDropzone && (
        <div
          {...getRootProps()}
          ref={dropzoneRef} // Attach the ref here
          className={`border-2 border-dashed rounded-md p-6 text-center transition-colors
          ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900' :
            error ? 'border-red-500 bg-red-50 dark:bg-red-900' :
            'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-gray-400'}
          text-gray-600 dark:text-gray-400
        `}
        >
          <input {...getInputProps()} aria-label="File upload" />
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <p>Uploading...</p>
            </div>
          ) : isDragActive ? (
            <p>Drop the files here ...</p>
          ) : (
            <div>
              <p>{label}</p>
              <p className="text-sm text-gray-500 mt-1">
                Accepted formats: {allowedExtensions} (max {(maxSize / 1024 / 1024).toFixed(1)}MB)
              </p>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900 p-2 rounded">
          {error}
        </div>
      )}
      
      {/* Progress Modal */}
      {showProgress && (
        <ProgressModal
          isOpen={showProgressModal}
          title="Uploading CSV"
          progress={progress}
          currentItem={currentItem}
          totalItems={totalItems}
          processedItems={processedItems}
          errors={errors}
          errorDetails={errorDetails}
          onClose={() => setShowProgressModal(false)}
          showSuccess={completed}
          successMessage={successMessage}
          isWebSocketConnected={isConnected}
        />
      )}
    </div>
  );
};

export type { FileUploadProps };

export default FileUpload;