import { apiClient } from "./api-client";
import { endpoints } from "./endpoints";
import type { PresignUploadResponse, Upload, UploadList } from "@/types/api";

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

const LOCAL_URL_SCHEME = "local://";

export interface PresignInput {
  filename: string;
  content_type: string;
  size_bytes: number;
}

/** PUT bytes directly to storage with upload progress (Part 3.8). */
function putBytes(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.round((event.loaded / event.total) * 100),
        });
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${request.status}`));
      }
    };
    request.onerror = () => reject(new Error("Upload failed — network error"));
    request.onabort = () => reject(new Error("Upload aborted"));
    request.send(file);
  });
}

export const uploadService = {
  async presign(input: PresignInput): Promise<PresignUploadResponse> {
    const { data } = await apiClient.post<PresignUploadResponse>(endpoints.uploads.presign, input);
    return data;
  },

  async complete(uploadId: string): Promise<Upload> {
    const { data } = await apiClient.post<Upload>(endpoints.uploads.complete(uploadId));
    return data;
  },

  async get(uploadId: string): Promise<Upload> {
    const { data } = await apiClient.get<Upload>(endpoints.uploads.get(uploadId));
    return data;
  },

  async list(params?: { skip?: number; limit?: number }): Promise<UploadList> {
    const { data } = await apiClient.get<UploadList>(endpoints.uploads.list, {
      params: { skip: params?.skip ?? 0, limit: params?.limit ?? 50 },
    });
    return data;
  },

  async remove(uploadId: string): Promise<void> {
    await apiClient.delete(endpoints.uploads.remove(uploadId));
  },

  /**
   * Run the full presign → PUT → complete flow for one file.
   *
   * `local://` pseudo-URLs (the default dev storage backend) have no HTTP
   * endpoint for the browser to PUT against — configure S3/MinIO for uploads
   * from the browser (Part 4.2 / Part 3.8).
   */
  async upload(
    file: File,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<Upload> {
    const presigned = await this.presign({
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    });

    if (presigned.upload_url.startsWith(LOCAL_URL_SCHEME)) {
      throw new Error(
        "The storage backend is not reachable from the browser (local:// URL). " +
          "Configure S3 or MinIO (STORAGE_BACKEND=s3) to upload files.",
      );
    }

    await putBytes(presigned.upload_url, file, onProgress);
    return this.complete(presigned.upload_id);
  },
};
