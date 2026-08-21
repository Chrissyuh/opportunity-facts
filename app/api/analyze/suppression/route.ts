import { analyzeRequestSchema } from "@/lib/analysis/pipeline";
import { failureSuppressionDecision } from "@/lib/analysis/product-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_048;
const MAX_BODY_READ_MS = 5_000;
const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
} as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStoreHeaders });
}

function allowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const timeoutSignal = AbortSignal.timeout(MAX_BODY_READ_MS);
  const signal = request.signal.aborted
    ? request.signal
    : AbortSignal.any([request.signal, timeoutSignal]);
  try {
    while (true) {
      let rejectOnAbort: (() => void) | undefined;
      const stopped = new Promise<never>((_resolve, reject) => {
        rejectOnAbort = () => reject(new Error("REQUEST_STOPPED"));
        if (signal.aborted) rejectOnAbort();
        else signal.addEventListener("abort", rejectOnAbort, { once: true });
      });
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await Promise.race([reader.read(), stopped]);
      } finally {
        if (rejectOnAbort) signal.removeEventListener("abort", rejectOnAbort);
      }
      if (result.done) break;
      total += result.value.byteLength;
      if (total > MAX_BODY_BYTES) throw new RangeError("REQUEST_TOO_LARGE");
      chunks.push(result.value);
    }
  } finally {
    if (signal.aborted) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return json({ code: "UNSUPPORTED_MEDIA_TYPE", message: "The request must use application/json." }, 415);
  }
  if (!allowedOrigin(request)) {
    return json({ code: "CROSS_ORIGIN_REQUEST", message: "Cross-origin requests are not accepted." }, 403);
  }
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
    return json({ code: "REQUEST_TOO_LARGE", message: "The request is too large." }, 413);
  }
  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof RangeError) return json({ code: "REQUEST_TOO_LARGE", message: "The request is too large." }, 413);
    return json({ code: "INVALID_REQUEST", message: "The request could not be read." }, 400);
  }
  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success || parsed.data.mode !== "url") {
    return json({ code: "INVALID_URL", message: "Enter a valid public opportunity URL." }, 400);
  }
  return json({ failureSuppression: failureSuppressionDecision(parsed.data.url) });
}
