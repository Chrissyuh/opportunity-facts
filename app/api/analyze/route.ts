import { ZodError } from "zod";
import {
  isAnalysisEnabled,
  tryAcquireAnalysisSlot,
} from "@/lib/analysis/admission-control";
import { PageFetchError } from "@/lib/analysis/fetch";
import {
  ModelConfigurationError,
  ModelExtractionError,
} from "@/lib/analysis/model-extraction";
import {
  analyzeRequestSchema,
} from "@/lib/analysis/pipeline";
import { runProductAnalysis, type AnalysisProductResult } from "@/lib/analysis/product-run";
import { createSequencedProgressSink } from "@/lib/analysis/progress";
import {
  acceptsAnalysisStream,
  ANALYSIS_STREAM_CONTENT_TYPE,
  encodeAnalysisStreamMessage,
} from "@/lib/analysis/stream-protocol";
import { UrlSafetyError } from "@/lib/analysis/url-safety";
import { ANALYZER_VERSION } from "@/lib/analysis/analyzer-version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel is the documented deployment target. Next.js 16 emits this route
// segment limit for platforms to enforce; the application deadline below
// leaves time to cancel I/O and return a controlled response first.
export const maxDuration = 300;

export const MAX_REQUEST_BODY_BYTES = 600_000;
export const MAX_REQUEST_BODY_READ_MS = 10_000;
export const MAX_ANALYSIS_REQUEST_MS = 270_000;
const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
} as const;

function json(
  body: unknown,
  status = 200,
  headers: Readonly<Record<string, string>> = {},
) {
  return Response.json(body, {
    status,
    headers: { ...noStoreHeaders, ...headers },
  });
}

function hasJsonContentType(request: Request): boolean {
  return request.headers.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase() === "application/json";
}

function hasAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readBoundedBody(
  request: Request,
  maximumBytes: number,
): Promise<string | null> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  let timedOut = false;
  let requestAborted = request.signal.aborted;
  const readController = new AbortController();
  const abortRead = () => {
    requestAborted = true;
    readController.abort();
  };
  if (request.signal.aborted) abortRead();
  else request.signal.addEventListener("abort", abortRead, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    readController.abort();
  }, MAX_REQUEST_BODY_READ_MS);

  const readNextChunk = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
    if (readController.signal.aborted) {
      throw new RequestBodyReadError(timedOut ? "REQUEST_TIMEOUT" : "REQUEST_ABORTED");
    }
    let rejectOnAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      rejectOnAbort = () => {
        reject(new RequestBodyReadError(timedOut ? "REQUEST_TIMEOUT" : "REQUEST_ABORTED"));
      };
      readController.signal.addEventListener("abort", rejectOnAbort, { once: true });
    });
    try {
      return await Promise.race([reader.read(), aborted]);
    } finally {
      if (rejectOnAbort) {
        readController.signal.removeEventListener("abort", rejectOnAbort);
      }
    }
  };

  try {
    while (true) {
      const result = await readNextChunk();
      if (result.done) break;
      byteLength += result.value.byteLength;
      if (byteLength > maximumBytes) {
        try {
          await reader.cancel("Analysis request exceeded the byte limit.");
        } catch {
          // The response remains a deterministic 413 even if stream cleanup fails.
        }
        return null;
      }
      chunks.push(result.value);
    }
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortRead);
    if (timedOut || requestAborted) {
      try {
        await reader.cancel("Analysis request body reading stopped.");
      } catch {
        // Preserve the controlled timeout/abort response when stream cleanup fails.
      }
    }
    reader.releaseLock();
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

class RequestBodyReadError extends Error {
  constructor(readonly code: "REQUEST_TIMEOUT" | "REQUEST_ABORTED") {
    super(code);
    this.name = "RequestBodyReadError";
  }
}

function safeAnalysisError(error: unknown): { code: string; message: string } {
  if (error instanceof UrlSafetyError) return { code: error.code, message: error.message };
  if (error instanceof PageFetchError) return { code: error.code, message: error.message };
  if (error instanceof ModelConfigurationError) return { code: "MODEL_NOT_CONFIGURED", message: error.message };
  if (error instanceof ModelExtractionError || error instanceof ZodError) {
    return { code: "EXTRACTION_FAILED", message: error instanceof ModelExtractionError ? error.message : "The extraction service returned an invalid structured result." };
  }
  if (error instanceof RangeError) return { code: "INPUT_TOO_LARGE", message: error.message };
  return { code: "ANALYSIS_FAILED", message: "The sources could not be analyzed. No submitted content was stored." };
}

function streamedAnalysisResponse(
  input: Parameters<typeof runProductAnalysis>[0],
  request: Request,
  analysisController: AbortController,
  releaseSlot: () => void,
): Response {
  let streamClosed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let timedOut = false;
      const send = (message: Parameters<typeof encodeAnalysisStreamMessage>[0]) => {
        if (!streamClosed) controller.enqueue(encodeAnalysisStreamMessage(message));
      };
      const progress = createSequencedProgressSink((event) => send({ type: "progress", event }));
      progress({ type: "accepted" });
      const abort = () => analysisController.abort(request.signal.reason);
      if (request.signal.aborted) abort();
      else request.signal.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(() => {
        timedOut = true;
        analysisController.abort(new Error("The analysis request reached its total deadline."));
      }, MAX_ANALYSIS_REQUEST_MS);
      const heartbeat = setInterval(() => progress({ type: "heartbeat" }), 15_000);
      void runProductAnalysis(input, {
        signal: analysisController.signal,
        onProgress: progress,
      }).then((result: AnalysisProductResult) => {
        send({ type: "complete", result });
      }).catch((error: unknown) => {
        const payload = timedOut
          ? { code: "ANALYSIS_TIMEOUT", message: "The analysis did not complete within the service time limit." }
          : analysisController.signal.aborted
            ? { code: "ANALYSIS_ABORTED", message: "The analysis request was cancelled." }
          : safeAnalysisError(error);
        send({ type: "error", ...payload });
      }).finally(() => {
        clearTimeout(timeout);
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", abort);
        releaseSlot();
        if (!streamClosed) {
          streamClosed = true;
          controller.close();
        }
      });
    },
    cancel(reason) {
      streamClosed = true;
      analysisController.abort(reason);
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

export async function GET() {
  const configured = isAnalysisEnabled() && Boolean(process.env.OPENAI_API_KEY?.trim());
  return json({
    configured,
    analyzerVersion: ANALYZER_VERSION,
    model: configured
      ? process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra"
      : null,
  });
}

export async function POST(request: Request) {
  let releaseSlot: (() => void) | null = null;
  let analysisController: AbortController | null = null;
  let analysisTimeout: ReturnType<typeof setTimeout> | null = null;
  let analysisTimedOut = false;
  const abortAnalysis = () => analysisController?.abort(request.signal.reason);
  try {
    if (!isAnalysisEnabled()) {
      return json(
        {
          code: "ANALYSIS_DISABLED",
          message: "Automatic extraction is temporarily unavailable.",
        },
        503,
      );
    }
    if (!hasJsonContentType(request)) {
      return json(
        {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Analysis requests must use application/json.",
        },
        415,
      );
    }
    if (!hasAllowedOrigin(request)) {
      return json(
        {
          code: "CROSS_ORIGIN_REQUEST",
          message: "Cross-origin analysis requests are not accepted.",
        },
        403,
      );
    }
    const declaredLengthHeader = request.headers.get("content-length");
    const declaredLength = declaredLengthHeader === null ? null : Number(declaredLengthHeader);
    if (
      declaredLength !== null &&
      (!/^\d+$/u.test(declaredLengthHeader ?? "") ||
        !Number.isSafeInteger(declaredLength) ||
        declaredLength > MAX_REQUEST_BODY_BYTES)
    ) {
      return json({ code: "REQUEST_TOO_LARGE", message: "The analysis request is too large." }, 413);
    }
    releaseSlot = tryAcquireAnalysisSlot();
    if (releaseSlot === null) {
      return json(
        {
          code: "ANALYSIS_BUSY",
          message: "The analysis service is at its current concurrency limit. Try again shortly.",
        },
        429,
        { "Retry-After": "10" },
      );
    }
    analysisController = new AbortController();
    if (request.signal.aborted) abortAnalysis();
    else request.signal.addEventListener("abort", abortAnalysis, { once: true });
    analysisTimeout = setTimeout(() => {
      analysisTimedOut = true;
      analysisController?.abort(new Error("The analysis request reached its total deadline."));
    }, MAX_ANALYSIS_REQUEST_MS);
    const bodyText = await readBoundedBody(request, MAX_REQUEST_BODY_BYTES);
    if (bodyText === null) {
      return json({ code: "REQUEST_TOO_LARGE", message: "The analysis request is too large." }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return json({ code: "INVALID_JSON", message: "The request body is not valid JSON." }, 400);
    }
    const parsedInput = analyzeRequestSchema.safeParse(body);
    if (!parsedInput.success) {
      return json(
        {
          code: "INVALID_INPUT",
          message: "The analysis request contains invalid or incomplete fields.",
          issues: parsedInput.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
      );
    }
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return json(
        {
          code: "MODEL_NOT_CONFIGURED",
          message:
            "Automatic extraction is not configured here. Use the sample, manual builder, or save your pasted sources until a server key is available.",
        },
        503,
      );
    }
    if (acceptsAnalysisStream(request)) {
      if (analysisTimeout !== null) clearTimeout(analysisTimeout);
      analysisTimeout = null;
      request.signal.removeEventListener("abort", abortAnalysis);
      const streamController = analysisController;
      const streamRelease = releaseSlot;
      analysisController = null;
      releaseSlot = null;
      return streamedAnalysisResponse(parsedInput.data, request, streamController, streamRelease);
    }
    const result = await runProductAnalysis(parsedInput.data, {
      signal: analysisController.signal,
    });
    if (analysisTimedOut || request.signal.aborted) {
      throw new AnalysisRequestStoppedError();
    }
    return json(result);
  } catch (error) {
    if (error instanceof RequestBodyReadError) {
      return json(
        {
          code: error.code,
          message: "The analysis request body was not received in time.",
        },
        408,
      );
    }
    if (analysisTimedOut) {
      return json(
        {
          code: "ANALYSIS_TIMEOUT",
          message: "The analysis did not complete within the service time limit.",
        },
        504,
      );
    }
    if (request.signal.aborted || error instanceof AnalysisRequestStoppedError) {
      return json(
        {
          code: "ANALYSIS_ABORTED",
          message: "The analysis request was cancelled.",
        },
        408,
      );
    }
    if (error instanceof ZodError) {
      return json(
        {
          code: "EXTRACTION_FAILED",
          message: "The extraction service returned an invalid structured result.",
        },
        502,
      );
    }
    if (error instanceof UrlSafetyError) {
      return json({ code: error.code, message: error.message }, 400);
    }
    if (error instanceof PageFetchError) {
      return json({ code: error.code, message: error.message }, 422);
    }
    if (error instanceof ModelConfigurationError) {
      return json({ code: "MODEL_NOT_CONFIGURED", message: error.message }, 503);
    }
    if (error instanceof ModelExtractionError) {
      return json({ code: "EXTRACTION_FAILED", message: error.message }, 502);
    }
    if (error instanceof RangeError) {
      return json({ code: "INPUT_TOO_LARGE", message: error.message }, 413);
    }
    return json(
      {
        code: "ANALYSIS_FAILED",
        message: "The sources could not be analyzed. No submitted content was stored.",
      },
      500,
    );
  } finally {
    if (analysisTimeout !== null) clearTimeout(analysisTimeout);
    request.signal.removeEventListener("abort", abortAnalysis);
    releaseSlot?.();
  }
}

class AnalysisRequestStoppedError extends Error {
  constructor() {
    super("Analysis request stopped.");
    this.name = "AnalysisRequestStoppedError";
  }
}
