/**
 * File validation constants mirrored from the backend allow-list
 * (`backend/app/modules/uploads/validation.py`, Part 11 / Part 3.8). The
 * backend remains authoritative — these only power client-side pre-checks.
 */
export const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "text/plain": ["txt", "md", "csv"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "video/mp4": ["mp4"],
};

export const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

export const DEFAULT_UPLOAD_LIMIT = 50;
export const DEFAULT_DOCUMENT_LIMIT = 50;
