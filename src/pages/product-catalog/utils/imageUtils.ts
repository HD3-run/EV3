// Utility functions for image handling

export function createImagePreview(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeImagePreview(previewUrl: string | null): void {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
}

export function getPrimaryImageUrl(images?: Array<{ image_url: string; is_primary: boolean }>): string | null {
  if (!images || images.length === 0) return null;
  const primaryImage = images.find(img => img.is_primary);
  return primaryImage ? primaryImage.image_url : images[0].image_url;
}

