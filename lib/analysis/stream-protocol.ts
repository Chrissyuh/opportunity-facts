import type { AnalysisProgressEvent } from "./progress";

export const ANALYSIS_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

export type AnalysisStreamMessage<Result = unknown> =
  | { readonly type: "progress"; readonly event: AnalysisProgressEvent }
  | { readonly type: "complete"; readonly result: Result }
  | { readonly type: "error"; readonly code: string; readonly message: string };

export function encodeAnalysisStreamMessage(message: AnalysisStreamMessage): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(message)}\n`);
}

export function acceptsAnalysisStream(request: Request): boolean {
  return request.headers.get("accept")
    ?.split(",")
    .some((value) => value.trim().toLowerCase().startsWith("application/x-ndjson")) ?? false;
}
