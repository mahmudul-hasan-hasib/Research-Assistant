import type { Citation, DocumentStatus, UploadStatus } from "@/types/api";

/** Map a backend status value to a stable UI tone. */
export function statusTone(
  status: UploadStatus | DocumentStatus,
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "ready":
      return "success";
    case "pending":
      return "neutral";
    case "processing":
      return "info";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

/** Presentable label for a backend status value. */
export function statusLabel(status: UploadStatus | DocumentStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function citationLabel(citation: Citation): string {
  const location = [citation.document_name, citation.page ? `p.${citation.page}` : null]
    .filter(Boolean)
    .join(" · ");
  return `[${citation.index}] ${location}`;
}
