import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@/types/constants";

export interface FileValidationResult {
  ok: boolean;
  reason?: string;
}

const MIME_TO_EXTENSION: Record<string, string[]> = ALLOWED_UPLOAD_TYPES;

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function contentTypeOf(filename: string): string | null {
  const ext = extensionOf(filename);
  for (const [mime, extensions] of Object.entries(MIME_TO_EXTENSION)) {
    if (extensions.includes(ext)) return mime;
  }
  return null;
}

/**
 * Client-side pre-check mirroring `validate_declared_upload` (Part 3.8). The
 * backend re-validates declared metadata and the actual bytes on `complete`.
 */
export function validateFile(file: File, maxBytes = MAX_UPLOAD_SIZE_BYTES): FileValidationResult {
  const mime = contentTypeOf(file.name);
  if (!mime) {
    return { ok: false, reason: "File type is not allowed (pdf, docx, txt, md, csv, png, jpg, jpeg, mp4)" };
  }
  if (file.size < 1) {
    return { ok: false, reason: "File cannot be empty" };
  }
  if (file.size > maxBytes) {
    return { ok: false, reason: `File exceeds the ${formatMaxBytes(maxBytes)} upload limit` };
  }
  return { ok: true };
}

function formatMaxBytes(maxBytes: number): string {
  return maxBytes >= 1024 ** 2 ? `${Math.round(maxBytes / 1024 ** 2)} MB` : `${maxBytes} B`;
}

export function fileTypeLabel(mime: string): string {
  const labels: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "text/plain": "Text",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "video/mp4": "MP4",
  };
  return labels[mime] ?? mime;
}
