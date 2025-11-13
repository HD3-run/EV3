import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// S3 Configuration
export const s3Config = {
  region: process.env.AWS_REGION || 'ap-south-1', // Mumbai region for India
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
};

// S3 Bucket name
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'ezpz-product-images';

// Initialize S3 Client
export const s3Client = new S3Client(s3Config);

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

// Max file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Validate image file
 */
export function validateImageFile(mimetype: string, size: number): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(mimetype)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.',
    };
  }

  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File size exceeds 5MB limit.',
    };
  }

  return { valid: true };
}

/**
 * Generate unique S3 key for image
 */
export function generateS3Key(originalFilename: string, productId?: number): string {
  const ext = path.extname(originalFilename);
  const uniqueId = uuidv4();
  const timestamp = Date.now();
  
  if (productId) {
    return `products/${productId}/${timestamp}-${uniqueId}${ext}`;
  }
  
  return `products/temp/${timestamp}-${uniqueId}${ext}`;
}

/**
 * Upload image to S3
 */
export async function uploadImageToS3(
  fileBuffer: Buffer,
  filename: string,
  mimetype: string,
  productId?: number
): Promise<{ success: boolean; imageUrl?: string; s3Key?: string; error?: string }> {
  try {
    // Validate file
    const validation = validateImageFile(mimetype, fileBuffer.length);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Generate S3 key
    const s3Key = generateS3Key(filename, productId);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: mimetype,
      // ACL removed - using bucket policy for public access instead
      Metadata: {
        originalName: filename,
        uploadedAt: new Date().toISOString(),
        productId: productId?.toString() || 'unknown',
      },
    });

    await s3Client.send(command);

    // Generate image URL
    const imageUrl = `https://${S3_BUCKET_NAME}.s3.${s3Config.region}.amazonaws.com/${s3Key}`;

    return {
      success: true,
      imageUrl,
      s3Key,
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image',
    };
  }
}

/**
 * Delete image from S3
 */
export async function deleteImageFromS3(s3Key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(command);

    return { success: true };
  } catch (error) {
    console.error('Error deleting from S3:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete image',
    };
  }
}

/**
 * Generate presigned URL for private images (valid for 1 hour)
 */
export async function generatePresignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw error;
  }
}

/**
 * Delete multiple images from S3
 */
export async function deleteMultipleImagesFromS3(s3Keys: string[]): Promise<{
  success: boolean;
  deletedCount: number;
  failedCount: number;
  errors?: string[];
}> {
  const results = await Promise.allSettled(
    s3Keys.map(key => deleteImageFromS3(key))
  );

  const deletedCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failedCount = results.length - deletedCount;
  const errors = results
    .filter(r => r.status === 'fulfilled' && !r.value.success)
    .map(r => r.status === 'fulfilled' ? r.value.error : 'Unknown error')
    .filter((e): e is string => e !== undefined);

  return {
    success: deletedCount === s3Keys.length,
    deletedCount,
    failedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

