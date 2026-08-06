/**
 * SSE consumer (Part 3.9 / D4). Streaming is NOT wired into the UI yet — this
 * module is the ready-to-use seam for the streaming phase: token/citation/tool
 * events arrive here and feed the Zustand streaming buffer. Until then the chat
 * feature falls back to the non-streaming agent run endpoint.
 */
import { logger } from "@/lib/logger";

export type StreamEventType = "token" | "tool_start" | "tool_result" | "citation" | "done" | "error";

export interface StreamEvent {
  kind: StreamEventType;
  data: unknown;
}

export interface StreamClientOptions {
  url: string;
  token?: string;
  reconnect?: boolean;
  heartbeatTimeoutMs?: number;
  onEvent: (event: StreamEvent) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

const DEFAULT_HEARTBEAT_TIMEOUT_MS = 60_000;

export class StreamClient {
  private source: EventSource | null = null;
  private readonly options: StreamClientOptions;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;

  constructor(options: StreamClientOptions) {
    this.options = options;
  }

  connect(): void {
    if (typeof window === "undefined" || this.source) return;
    const { url, token } = this.options;
    this.closedByUser = false;

    try {
      this.source = new EventSource(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    } catch {
      logger.error("stream_client.connect_failed");
      this.options.onError?.(new Error("Failed to open stream connection"));
      return;
    }

    this.source.onopen = () => this.resetHeartbeat();
    this.source.onerror = () => {
      logger.warn("stream_client.connection_error");
      if (this.closedByUser) return;
      if (this.options.reconnect !== false) {
        this.close();
        this.connect();
      } else {
        this.options.onError?.(new Error("Stream connection lost"));
      }
    };
    this.source.addEventListener("message", (message: MessageEvent<string>) => {
      this.resetHeartbeat();
      this.dispatch(message.data);
    });
  }

  close(): void {
    this.closedByUser = true;
    this.clearHeartbeat();
    this.source?.close();
    this.source = null;
    this.options.onClose?.();
  }

  private dispatch(raw: string): void {
    try {
      const event = JSON.parse(raw) as StreamEvent;
      this.options.onEvent(event);
      if (event.kind === "done") this.close();
    } catch {
      logger.warn("stream_client.invalid_payload", { raw });
      this.options.onError?.(new Error("Invalid stream payload"));
    }
  }

  private resetHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setTimeout(() => {
      logger.warn("stream_client.heartbeat_timeout");
      this.options.onError?.(new Error("Stream heartbeat timed out"));
      this.close();
    }, this.options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
