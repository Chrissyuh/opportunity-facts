import { ZodError } from "zod";
import { createAnalysisBatchManifest } from "@/lib/analysis/batch-server";
import { isAnalysisEnabled } from "@/lib/analysis/admission-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const MAX_BATCH_REQUEST_BYTES = 16_000;

const headers = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers });
}

function allowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function POST(request: Request) {
  if (!isAnalysisEnabled()) return json({ code: "ANALYSIS_DISABLED", message: "Automatic extraction is temporarily unavailable." }, 503);
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return json({ code: "UNSUPPORTED_MEDIA_TYPE", message: "Batch requests must use application/json." }, 415);
  }
  if (!allowedOrigin(request)) return json({ code: "CROSS_ORIGIN_REQUEST", message: "Cross-origin analysis requests are not accepted." }, 403);
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BATCH_REQUEST_BYTES) {
      return json({ code: "REQUEST_TOO_LARGE", message: "The batch request is too large." }, 413);
    }
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BATCH_REQUEST_BYTES) {
      return json({ code: "REQUEST_TOO_LARGE", message: "The batch request is too large." }, 413);
    }
    const manifest = createAnalysisBatchManifest(JSON.parse(body));
    return json(manifest);
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ code: "INVALID_INPUT", message: "Enter between one and five valid public opportunity URLs.", issues: error.issues }, 400);
    }
    return json({ code: "INVALID_INPUT", message: error instanceof SyntaxError ? "The batch request is not valid JSON." : error instanceof Error ? error.message : "The batch request is invalid." }, 400);
  }
}
