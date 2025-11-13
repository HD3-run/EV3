import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET_NAME, generateS3Key, validateImageFile } from '../../utils/s3-config';
import { createReadStream, unlinkSync } from 'fs';

// Helper function to upload file from disk to S3 (streams directly, no memory buffer)
export async function uploadFileToS3(
  filePath: string,
  originalName: string,
  mimetype: string,
  productId?: number
): Promise<{ success: boolean; s3Key?: string; imageUrl?: string; error?: string }> {
  try {
    // Validate file
    const validation = validateImageFile(mimetype, 0); // Size already validated by multer
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Generate S3 key
    const s3Key = generateS3Key(originalName, productId);
    
    // Stream file from disk directly to S3 (no memory buffer)
    const fileStream = createReadStream(filePath);
    
    // Upload to S3 using stream
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      Body: fileStream,
      ContentType: mimetype,
      Metadata: {
        originalName: originalName,
        uploadedAt: new Date().toISOString(),
        productId: productId?.toString() || 'unknown',
      },
    });

    await s3Client.send(command);

    // Generate image URL
    const region = process.env.AWS_REGION || 'ap-south-1';
    const imageUrl = `https://${S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${s3Key}`;

    // Clean up temp file
    try {
      unlinkSync(filePath);
    } catch (unlinkError) {
      console.warn('Failed to delete temp file:', unlinkError);
    }

    return {
      success: true,
      s3Key,
      imageUrl,
    };
  } catch (error) {
    // Clean up temp file on error
    try {
      unlinkSync(filePath);
    } catch (unlinkError) {
      console.warn('Failed to delete temp file after error:', unlinkError);
    }
    
    console.error('Error uploading to S3:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image',
    };
  }
}

