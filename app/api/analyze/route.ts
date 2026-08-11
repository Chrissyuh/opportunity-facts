import { ZodError } from "zod";
import { PageFetchError } from "@/lib/analysis/fetch";
import {
  ModelConfigurationError,
  ModelExtractionError,
} from "@/lib/analysis/model-extraction";
import {
  analyzeRequest,
  analyzeRequestSchema,
} from "@/lib/analysis/pipeline";
import { UrlSafetyError } from "@/lib/analysis/url-safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const MAX_REQUEST_BODY_BYTES = 600_000;
const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
} as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStoreHeaders });
}

async function readBoundedBody(
  request: Request,
  maximumBytes: number,
): Promise<string | null> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const result = await reader.read();
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

export async function GET() {
  return json({
    configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    model: process.env.OPENAI_API_KEY?.trim()
      ? process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra"
      : null,
  });
}

export async function POST(request: Request) {
  try {
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
    const result = await analyzeRequest(parsedInput.data, { signal: request.signal });
    return json(result);
  } catch (error) {
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
  }
}
