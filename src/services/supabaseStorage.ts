import { buildApiUrl } from "@/lib/apiBase";

export type StorageBucket = "compositions" | "thumbnails" | "avatars";

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
 * Upload file via the Cloudflare Worker API.
 * Uses the stored JWT token for auth.
 */
export async function uploadFile(
  file: File,
  options: UploadOptions,
): Promise<UploadResult> {
  const token = localStorage.getItem("murekefu_auth_token");
  if (!token) {
    throw new Error("User must be authenticated to upload files");
  }

  if (!file) {
    throw new Error("No file selected for upload");
  }

  if (file.size > 30 * 1024 * 1024) {
    throw new Error("File is too large. Please keep it under 30MB.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const url = buildApiUrl(`/upload/${options.bucket}`);
  const timeoutMs = 30000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `Upload failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // ignore parse failures
      }
      throw new Error(errorMessage);
    }

    const result: any = await response.json();
    if (!result.success || !result.url) {
      throw new Error("Server upload returned no URL");
    }

    return {
      id: result.fileId || result.id || "",
      url: result.url,
      path: result.fileName || result.path || "",
    };
  } catch (error) {
    console.error("File upload error:", error);
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Upload composition file (PDF/MIDI)
 */
export async function uploadComposition(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadResult> {
  if (!file.type.includes("pdf") && !file.type.includes("audio")) {
    throw new Error(
      "Invalid file type. Only PDFs and audio files are allowed.",
    );
  }

  return uploadFile(file, {
    bucket: "compositions",
    onProgress,
  });
}

/**
 * Upload composition thumbnail
 */
export async function uploadThumbnail(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Invalid file type. Only images are allowed.");
  }

  return uploadFile(file, {
    bucket: "thumbnails",
    onProgress,
  });
}

/**
 * Upload user avatar
 */
export async function uploadAvatar(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Invalid file type. Only images are allowed.");
  }

  return uploadFile(file, {
    bucket: "avatars",
    onProgress,
  });
}

/**
 * Delete file via the Cloudflare Worker API
 */
export async function deleteFile(
  bucket: StorageBucket,
  filePath: string,
): Promise<void> {
  const token = localStorage.getItem("murekefu_auth_token");
  if (!token) {
    throw new Error("User must be authenticated to delete files");
  }

  const url = buildApiUrl(`/upload/${bucket}`);
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: filePath }),
  });

  if (!response.ok) {
    let errorMessage = `Delete failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // ignore parse failures
    }
    throw new Error(errorMessage);
  }
}

/**
 * Get user's uploaded files via the API
 */
export async function getUserFiles(bucket?: StorageBucket): Promise<any[]> {
  const token = localStorage.getItem("murekefu_auth_token");
  if (!token) {
    throw new Error("User must be authenticated");
  }

  const endpoint = bucket ? `/upload/${bucket}/files` : "/upload/files";
  const url = buildApiUrl(endpoint);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user files: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : (data.items || data.files || []);
}

// Keep backward compatibility exports
export default {
  uploadFile,
  uploadComposition,
  uploadThumbnail,
  uploadAvatar,
  deleteFile,
  getUserFiles,
};
