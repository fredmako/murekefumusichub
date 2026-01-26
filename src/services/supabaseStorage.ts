import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/firebase';

export type StorageBucket = 'compositions' | 'thumbnails' | 'avatars';

export interface UploadOptions {
  bucket: StorageBucket;
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  id: string;
  url: string;
  path: string;
}

/**
 * Upload file to Supabase Storage
 * Uses Firebase UID as the user identifier in the path
 */
export async function uploadFile(
  file: File,
  options: UploadOptions
): Promise<UploadResult> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to upload files');
  }

  try {
    // Create a unique file path: bucket/firebase-uid/timestamp-filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
    const filePath = `${user.uid}/${timestamp}-${sanitizedFileName}`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(options.bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(options.bucket)
      .getPublicUrl(filePath);

    const storageUrl = urlData.publicUrl;

    // Record file upload in database for tracking
    const { data: fileRecord, error: dbError } = await supabase
      .from('file_uploads')
      .insert({
        user_id: (await supabase
          .from('users')
          .select('id')
          .eq('firebase_uid', user.uid)
          .single()).data?.id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        bucket: options.bucket,
        storage_url: storageUrl,
      })
      .select()
      .single();

    if (dbError) {
      console.warn('Failed to record file upload in database:', dbError);
      // Continue anyway - file is uploaded, just not tracked
    }

    return {
      id: fileRecord?.id || data.id,
      url: storageUrl,
      path: filePath,
    };
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
}

/**
 * Upload composition file (PDF/Music scores)
 */
export async function uploadComposition(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  if (!file.type.includes('pdf') && !file.type.includes('audio')) {
    throw new Error('Invalid file type. Only PDFs and audio files are allowed.');
  }

  return uploadFile(file, {
    bucket: 'compositions',
    onProgress,
  });
}

/**
 * Upload composition thumbnail
 */
export async function uploadThumbnail(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Invalid file type. Only images are allowed.');
  }

  return uploadFile(file, {
    bucket: 'thumbnails',
    onProgress,
  });
}

/**
 * Upload user avatar
 */
export async function uploadAvatar(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Invalid file type. Only images are allowed.');
  }

  return uploadFile(file, {
    bucket: 'avatars',
    onProgress,
  });
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFile(
  bucket: StorageBucket,
  filePath: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to delete files');
  }

  try {
    // Only allow users to delete their own files
    if (!filePath.startsWith(user.uid)) {
      throw new Error('You do not have permission to delete this file');
    }

    const { error: deleteError } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (deleteError) {
      throw new Error(`Delete failed: ${deleteError.message}`);
    }

    // Remove file record from database
    const { error: dbError } = await supabase
      .from('file_uploads')
      .delete()
      .eq('file_path', filePath)
      .eq('bucket', bucket);

    if (dbError) {
      console.warn('Failed to delete file record from database:', dbError);
    }
  } catch (error) {
    console.error('File deletion error:', error);
    throw error;
  }
}

/**
 * Get user's uploaded files
 */
export async function getUserFiles(
  bucket?: StorageBucket
): Promise<any[]> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  try {
    let query = supabase
      .from('file_uploads')
      .select('*')
      .eq('user_id', user.uid);

    if (bucket) {
      query = query.eq('bucket', bucket);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user files:', error);
    throw error;
  }
}

/**
 * Get signed URL for private file access
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to get signed URL: ${error.message}`);
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw error;
  }
}

export default {
  uploadFile,
  uploadComposition,
  uploadThumbnail,
  uploadAvatar,
  deleteFile,
  getUserFiles,
  getSignedUrl,
};
