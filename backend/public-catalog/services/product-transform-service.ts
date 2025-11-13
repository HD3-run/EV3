// Product transformation service for public catalog

/**
 * Transform product tags from various formats to consistent format
 */
export function transformTags(tags: any): any[] {
  let transformedTags: any[] = [];
  if (tags) {
    if (Array.isArray(tags)) {
      if (tags.length > 0 && typeof tags[0] === 'string') {
        // Convert string array to object array
        transformedTags = tags.map((tag: string, index: number) => ({
          tag_id: index + 1,
          tag_name: tag,
        }));
      } else {
        // Already in object format
        transformedTags = tags;
      }
    }
  }
  return transformedTags;
}

/**
 * Transform product images from various formats to consistent format
 */
export function transformImages(images: any): any[] {
  let transformedImages: any[] = [];
  if (images) {
    if (Array.isArray(images)) {
      transformedImages = images.map((img: any) => ({
        ...img,
        image_id: img.image_id || img.catalogue_id,
        image_url: img.image_url || img.media_url,
      }));
    }
  }
  return transformedImages;
}

/**
 * Transform a single product for public catalog
 */
export function transformPublicProduct(product: any): any {
  const transformedTags = transformTags(product.tags);
  const transformedImages = transformImages(product.images || product.catalog_images);
  
  // Map status to is_active (database has 'status' string, frontend expects 'is_active' boolean)
  const isActive = product.status === 'active' || product.is_active === true;
  
  return {
    ...product,
    tags: transformedTags,
    images: transformedImages,
    is_active: isActive,
  };
}

/**
 * Transform multiple products for public catalog
 */
export function transformPublicProducts(products: any[]): any[] {
  return products.map(product => transformPublicProduct(product));
}

