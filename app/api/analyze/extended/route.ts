import { ZodError } from "zod";
import { isAnalysisEnabled, tryAcquireAnalysisSlot } from "@/lib/analysis/admission-control";
import {
  ResearchSessionUnavailableError,
  runExtendedResearch,
  type ExtendedResearchResult,
} from "@/lib/analysis/extended-research";
import { ModelConfigurationError, ModelExtractionError } from "@/lib/analysis/model-extraction";
import { createSequencedProgressSink } from "@/lib/analysis/progress";
import { extendedResearchRequestSchema } from "@/lib/analysis/research-session";
import {
  acceptsAnalysisStream,
  ANALYSIS_STREAM_CONTENT_TYPE,
  encodeAnalysisStreamMessage,
} from "@/lib/analysis/stream-protocol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MAX_EXTENDED_BODY_BYTES = 2_048;
export const MAX_EXTENDED_BODY_READ_MS = 10_000;
const MAX_EXTENDED_REQUEST_MS = 150_000;
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStoreHeaders });
}

function allowedRequest(request: Request) {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return json({ code: "UNSUPPORTED_MEDIA_TYPE", message: "Extended Research requests must use application/json." }, 415);
  }
  const origin = request.headers.get("origin");
  if (origin !== null) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return json({ code: "CROSS_ORIGIN_REQUEST", message: "Cross-origin analysis requests are not accepted." }, 403);
      }
    } catch {
      return json({ code: "CROSS_ORIGIN_REQUEST", message: "Cross-origin analysis requests are not accepted." }, 403);
    }
  }
  return null;
}

function safeError(error: unknown) {
  if (error instanceof ResearchSessionUnavailableError) return { code: "RESEARCH_SESSION_UNAVAILABLE", message: error.message };
  if (error instanceof ModelConfigurationError) return { code: "MODEL_NOT_CONFIGURED", message: error.message };
  if (error instanceof ModelExtractionError || error instanceof ZodError) {
    return { code: "EXTENDED_RESEARCH_FAILED", message: "Extended Research could not complete. Your original result remains available." };
  }
  return { code: "EXTENDED_RESEARCH_FAILED", message: "Extended Research could not complete. Your original result remains available." };
}

class ExtendedBodyReadError extends Error {
  constructor(readonly code: "REQUEST_TIMEOUT" | "REQUEST_ABORTED") {
    super(code);
    this.name = "ExtendedBodyReadError";
  }
}

async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timedOut = false;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (request.signal.aborted) abort();
  else request.signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, MAX_EXTENDED_BODY_READ_MS);
  try {
    while (true) {
      const result = await Promise.race([
        reader.read(),
        new Promise<never>((_resolve, reject) => {
          if (controller.signal.aborted) reject(new ExtendedBodyReadError(timedOut ? "REQUEST_TIMEOUT" : "REQUEST_ABORTED"));
          else controller.signal.addEventListener("abort", () => reject(new ExtendedBodyReadError(timedOut ? "REQUEST_TIMEOUT" : "REQUEST_ABORTED")), { once: true });
        }),
      ]);
      if (result.done) break;
      total += result.value.byteLength;
      if (total > MAX_EXTENDED_BODY_BYTES) {
        await reader.cancel("Extended Research request exceeded the byte limit.").catch(() => undefined);
        return null;
      }
      chunks.push(result.value);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return body;
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
    if (controller.signal.aborted) {
      await reader.cancel("Extended Research request body reading stopped.").catch(() => undefined);
    }
    reader.releaseLock();
  }
}

function streamResponse(
  sessionId: string,
  request: Request,
  controller: AbortController,
  release: () => void,
) {
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      const send = (message: Parameters<typeof encodeAnalysisStreamMessage>[0]) => {
        if (!closed) streamController.enqueue(encodeAnalysisStreamMessage(message));
      };
      const progress = createSequencedProgressSink((event) => send({ type: "progress", event }));
      const abort = () => controller.abort(request.signal.reason);
      if (request.signal.aborted) abort();
      else request.signal.addEventListener("abort", abort, { once: true });
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error("Extended Research reached its deadline."));
      }, MAX_EXTENDED_REQUEST_MS);
      const heartbeat = setInterval(() => progress({ type: "heartbeat" }), 15_000);
      void runExtendedResearch(sessionId, { signal: controller.signal, onProgress: progress })
        .then((result: ExtendedResearchResult) => send({ type: "complete", result }))
        .catch((error: unknown) => send({
          type: "error",
          ...(timedOut
            ? { code: "EXTENDED_RESEARCH_TIMEOUT", message: "Extended Research took too long. Your original result remains available." }
            : controller.signal.aborted
              ? { code: "EXTENDED_RESEARCH_ABORTED", message: "Extended Research was cancelled. Your original result remains available." }
              : safeError(error)),
        }))
        .finally(() => {
          clearTimeout(timeout);
          clearInterval(heartbeat);
          request.signal.removeEventListener("abort", abort);
          release();
          if (!closed) {
            closed = true;
            streamController.close();
          }
        });
    },
    cancel(reason) {
      closed = true;
      controller.abort(reason);
    },
  });
  return new Response(stream, {
    headers: {
      ...noStoreHeaders,
      "Content-Type": ANALYSIS_STREAM_CONTENT_TYPE,
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  if (!isAnalysisEnabled()) return json({ code: "ANALYSIS_DISABLED", message: "Automatic extraction is temporarily unavailable." }, 503);
  const rejected = allowedRequest(request);
  if (rejected) return rejected;
  if (!process.env.OPENAI_API_KEY?.trim()) return json({ code: "MODEL_NOT_CONFIGURED", message: "Automatic extraction is not configured here." }, 503);
  const declaredHeader = request.headers.get("content-length");
  const declared = declaredHeader === null ? null : Number(declaredHeader);
  if (declared !== null && (!/^\d+$/u.test(declaredHeader ?? "") || !Number.isSafeInteger(declared) || declared > MAX_EXTENDED_BODY_BYTES)) {
    return json({ code: "REQUEST_TOO_LARGE", message: "The request is too large." }, 413);
  }
  const release = tryAcquireAnalysisSlot();
  if (!release) return json({ code: "ANALYSIS_BUSY", message: "The analysis service is at its current concurrency limit. Try again shortly." }, 429);
  let handedOff = false;
  const controller = new AbortController();
  const abort = () => controller.abort(request.signal.reason);
  if (request.signal.aborted) abort();
  else request.signal.addEventListener("abort", abort, { once: true });
  try {
    const bytes = await readBoundedBody(request);
    if (bytes === null) return json({ code: "REQUEST_TOO_LARGE", message: "The request is too large." }, 413);
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return json({ code: "INVALID_JSON", message: "The request body is not valid JSON." }, 400);
    }
    const parsed = extendedResearchRequestSchema.safeParse(body);
    if (!parsed.success) return json({ code: "INVALID_INPUT", message: "A valid Extended Research session is required." }, 400);
    if (acceptsAnalysisStream(request)) {
      handedOff = true;
      request.signal.removeEventListener("abort", abort);
      return streamResponse(parsed.data.sessionId, request, controller, release);
    }
    const timeout = setTimeout(() => controller.abort(new Error("Extended Research reached its deadline.")), MAX_EXTENDED_REQUEST_MS);
    try {
      return json(await runExtendedResearch(parsed.data.sessionId, { signal: controller.signal }));
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (error instanceof ExtendedBodyReadError) {
      return json({ code: error.code, message: "The Extended Research request body was not received in time." }, 408);
    }
    const payload = controller.signal.aborted
      ? { code: "EXTENDED_RESEARCH_ABORTED", message: "Extended Research stopped. Your original result remains available." }
      : safeError(error);
    return json(payload, error instanceof ResearchSessionUnavailableError ? 410 : 502);
  } finally {
    request.signal.removeEventListener("abort", abort);
    if (!handedOff) release();
  }
}
