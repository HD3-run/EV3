import { PoolClient } from 'pg';
import { uploadFileToS3 } from '../utils/s3Upload';
import { deleteImageFromS3 } from '../../utils/s3-config';
import {
  verifyProductOwnership,
  getImageDetails,
  checkImageIsPrimary,
  getFirstRemainingImage,
  verifyImageOwnership,
} from '../queries/image-queries';

export interface UploadImageData {
  is_primary?: string | boolean;
  is_featured?: string | boolean;
  alt_text?: string;
  display_order?: string | number;
  media_type?: string;
}

// Upload image service
export async function uploadImageService(
  client: PoolClient,
  productId: number,
  merchantId: number,
  filePath: string,
  originalName: string,
  mimetype: string,
  imageData: UploadImageData
): Promise<any> {
  const {
    is_primary = 'false',
    is_featured = 'false',
    alt_text,
    display_order = '0',
    media_type = 'image',
  } = imageData;

  // Verify product ownership
  const productExists = await verifyProductOwnership(client, productId, merchantId);
  if (!productExists) {
    throw new Error('Product not found or does not belong to your merchant account');
  }

  // Upload to S3
  const uploadResult = await uploadFileToS3(filePath, originalName, mimetype, productId);
  if (!uploadResult.success) {
    throw new Error(uploadResult.error || 'Failed to upload image to S3');
  }

  const { s3Key, imageUrl } = uploadResult;

  // Get is_featured value
  const shouldBeFeatured = is_featured === 'true' || is_featured === true || (typeof is_featured === 'number' && is_featured === 1) || is_featured === '1';
  
  // If this is primary, unset other primary images
  if (is_primary === 'true' || is_primary === true) {
    await client.query(
      'UPDATE oms.product_catalogue SET is_primary = false WHERE product_id = $1',
      [productId]
    );
  }

  // Insert image record
  const result = await client.query(
    `INSERT INTO oms.product_catalogue 
     (product_id, s3_key, media_url, media_type, is_primary, is_featured, display_order, alt_text, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
     RETURNING *`,
    [
      productId,
      s3Key,
      imageUrl,
      media_type,
      is_primary === 'true' || is_primary === true,
      shouldBeFeatured,
      parseInt(display_order.toString()),
      alt_text || null,
    ]
  );

  return result.rows[0];
}

// Delete image service
export async function deleteImageService(
  client: PoolClient,
  productId: number,
  catalogueId: number,
  merchantId: number
): Promise<void> {
  // Verify product ownership
  const productExists = await verifyProductOwnership(client, productId, merchantId);
  if (!productExists) {
    throw new Error('Product not found or does not belong to your merchant account');
  }

  // Get image details
  const imageDetails = await getImageDetails(client, catalogueId, productId);
  if (!imageDetails) {
    throw new Error('Image not found');
  }

  const s3Key = imageDetails.s3_key;

  // Check if image is primary
  const wasPrimary = await checkImageIsPrimary(client, catalogueId, productId);

  // Delete from database
  await client.query(
    'DELETE FROM oms.product_catalogue WHERE catalogue_id = $1',
    [catalogueId]
  );

  // If deleted image was primary, set another as primary
  if (wasPrimary) {
    const remainingImage = await getFirstRemainingImage(client, productId);
    if (remainingImage) {
      await client.query(
        'UPDATE oms.product_catalogue SET is_primary = true WHERE catalogue_id = $1',
        [remainingImage.catalogue_id]
      );
    }
  }

  // Delete from S3
  await deleteImageFromS3(s3Key);
}

// Set primary image service
export async function setPrimaryImageService(
  client: PoolClient,
  productId: number,
  catalogueId: number,
  merchantId: number
): Promise<void> {
  // Verify product ownership
  const productExists = await verifyProductOwnership(client, productId, merchantId);
  if (!productExists) {
    throw new Error('Product not found');
  }

  // Verify image ownership
  const imageExists = await verifyImageOwnership(client, catalogueId, productId);
  if (!imageExists) {
    throw new Error('Image not found');
  }

  // Unset all other primary images
  await client.query(
    'UPDATE oms.product_catalogue SET is_primary = false WHERE product_id = $1',
    [productId]
  );

  // Set this image as primary
  await client.query(
    'UPDATE oms.product_catalogue SET is_primary = true WHERE catalogue_id = $1',
    [catalogueId]
  );
}

