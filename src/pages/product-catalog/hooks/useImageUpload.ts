import { useState } from 'react';
import { revokeImagePreview, createImagePreview } from '../utils/imageUtils';

export function useImageUpload() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageSelect = (file: File | null) => {
    // Clean up previous preview
    if (imagePreview) {
      revokeImagePreview(imagePreview);
    }

    if (file) {
      setSelectedImage(file);
      setImagePreview(createImagePreview(file));
    } else {
      setSelectedImage(null);
      setImagePreview(null);
    }
  };

  const clearImage = () => {
    if (imagePreview) {
      revokeImagePreview(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
  };

  return {
    selectedImage,
    imagePreview,
    uploading,
    setUploading,
    handleImageSelect,
    clearImage,
  };
}

