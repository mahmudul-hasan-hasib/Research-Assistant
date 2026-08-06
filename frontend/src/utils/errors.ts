import type { ApiProblem } from "@/types/api";

export interface ApiErrorOptions {
  status?: number;
  detail?: string;
  title?: string;
  traceId?: string;
}

export class ApiError extends Error {
  readonly status?: number;
  readonly title?: string;
  readonly traceId?: string;
  readonly problem?: ApiProblem;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.title = options.title;
    this.traceId = options.traceId;
  }
}

/** Extract a human-readable message from a failed request. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}
