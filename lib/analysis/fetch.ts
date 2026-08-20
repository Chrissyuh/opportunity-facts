import "server-only";

import { request as httpRequest, type IncomingMessage, type RequestOptions } from "node:http";
import { request as httpsRequest, type RequestOptions as HttpsRequestOptions } from "node:https";
import { isIP, type LookupFunction } from "node:net";

import type {
  AcquiredSourcePage,
  AcquiredSourceSet,
  DnsResolver,
  FetchedPage,
  HttpTransport,
  HttpTransportResponse,
  PageAcquisitionFailure,
  ResolvedAddress,
  SupportedPageContentType,
} from "./types";
import { extractFetchedPage } from "./html-extraction";
import {
  MAX_DISCOVERED_PAGES,
  rankSameOriginLinks,
} from "./link-discovery";
import {
  haveSameOrigin,
  ipAddressesEqual,
  normalizeUrlHostname,
  parsePublicHttpUrl,
  UrlSafetyError,
  validatePublicUrl,
} from "./url-safety";

export const PUBLIC_PAGE_FETCH_LIMITS = Object.freeze({
  timeoutMs: 10_000,
  maxBytes: 1_500_000,
  maxRedirects: 5,
  maxResponseHeaderBytes: 16_384,
});

export const PUBLIC_PAGE_USER_AGENT =
  "OpportunityFacts/0.1 (public opportunity disclosure fetcher; no authentication)";

export type PageFetchErrorCode =
  | "INVALID_LIMIT"
  | "ABORTED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "REMOTE_ADDRESS_MISMATCH"
  | "INVALID_STATUS"
  | "HTTP_STATUS"
  | "REDIRECT_WITHOUT_LOCATION"
  | "INVALID_REDIRECT"
  | "CROSS_ORIGIN_REDIRECT"
  | "TOO_MANY_REDIRECTS"
  | "MISSING_CONTENT_TYPE"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "UNSUPPORTED_CONTENT_ENCODING"
  | "INVALID_CONTENT_LENGTH"
  | "RESPONSE_TOO_LARGE"
  | "UNSUPPORTED_CHARSET"
  | "INVALID_BODY_CHUNK";

export class PageFetchError extends Error {
  readonly code: PageFetchErrorCode;

  constructor(code: PageFetchErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PageFetchError";
    this.code = code;
  }
}

export interface FetchPublicPageOptions {
  readonly resolver?: DnsResolver;
  readonly transport?: HttpTransport;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly maxRedirects?: number;
  /** When set, redirect destinations must remain on this normalized origin. */
  readonly allowedRedirectOrigin?: string | URL;
  /**
   * Allows one transition away from `allowedRedirectOrigin`, then pins every
   * later redirect to that destination origin. Used only for one ranked
   * application candidate during bounded same-origin discovery.
   */
  readonly allowSinglePublicCrossOriginRedirect?: boolean;
  readonly signal?: AbortSignal;
  readonly now?: () => Date;
}

function validateIntegerLimit(
  value: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new PageFetchError(
      "INVALID_LIMIT",
      `${name} must be an integer from ${minimum} through ${maximum}.`,
    );
  }
  return value;
}

function responseHeaders(response: IncomingMessage): Readonly<
  Record<string, string | readonly string[] | undefined>
> {
  return Object.fromEntries(
    Object.entries(response.headers).map(([name, value]) => [name, value]),
  );
}

async function* incomingMessageBody(
  response: IncomingMessage,
): AsyncGenerator<Uint8Array> {
  for await (const rawChunk of response) {
    const chunk: unknown = rawChunk;
    if (typeof chunk === "string") {
      yield Buffer.from(chunk);
    } else if (chunk instanceof Uint8Array) {
      yield chunk;
    } else {
      response.destroy();
      throw new PageFetchError(
        "INVALID_BODY_CHUNK",
        "The remote server returned an unreadable response body.",
      );
    }
  }
}

/**
 * Node transport that pins socket DNS lookup to the already-validated address.
 * Keeping the original hostname in request options preserves Host and TLS SNI.
 */
export const pinnedNodeHttpTransport: HttpTransport = async ({
  url,
  address,
  headers,
  signal,
}) =>
  new Promise<HttpTransportResponse>((resolve, reject) => {
    const hostname = normalizeUrlHostname(url.hostname);
    const lookupPinnedAddress: LookupFunction = (
      _hostname,
      lookupOptions,
      callback,
    ) => {
      if (lookupOptions.all) {
        callback(null, [{ address: address.address, family: address.family }]);
      } else {
        callback(null, address.address, address.family);
      }
    };

    const onResponse = (response: IncomingMessage) => {
      const remoteAddress = response.socket.remoteAddress;
      if (!remoteAddress || !ipAddressesEqual(remoteAddress, address.address)) {
        response.destroy();
        reject(
          new PageFetchError(
            "REMOTE_ADDRESS_MISMATCH",
            "The connection did not reach the validated public address.",
          ),
        );
        return;
      }

      resolve({
        status: response.statusCode ?? 0,
        headers: responseHeaders(response),
        body: incomingMessageBody(response),
        dispose: () => response.destroy(),
      });
    };

    const baseOptions: RequestOptions = {
      protocol: url.protocol,
      hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers,
      lookup: lookupPinnedAddress,
      agent: false,
      maxHeaderSize: PUBLIC_PAGE_FETCH_LIMITS.maxResponseHeaderBytes,
      signal,
    };

    const request =
      url.protocol === "https:"
        ? httpsRequest(
            {
              ...baseOptions,
              servername: isIP(hostname) === 0 ? hostname : undefined,
            } satisfies HttpsRequestOptions,
            onResponse,
          )
        : httpRequest(baseOptions, onResponse);

    request.once("error", (cause: Error) => reject(cause));
    request.end();
  });

function getHeader(
  headers: HttpTransportResponse["headers"],
  name: string,
): string | undefined {
  const value = Object.entries(headers).find(
    ([headerName]) => headerName.toLowerCase() === name,
  )?.[1];

  if (Array.isArray(value)) {
    return value.length === 1 ? value[0] : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function parseContentType(value: string | undefined): {
  contentType: SupportedPageContentType;
  charset: string;
} {
  if (!value) {
    throw new PageFetchError(
      "MISSING_CONTENT_TYPE",
      "The remote page did not provide a Content-Type header.",
    );
  }

  const [mediaType = "", ...parameters] = value.split(";");
  const normalizedMediaType = mediaType.trim().toLowerCase();
  if (normalizedMediaType !== "text/html" && normalizedMediaType !== "text/plain") {
    throw new PageFetchError(
      "UNSUPPORTED_CONTENT_TYPE",
      "Only HTML and plain-text pages can be reviewed.",
    );
  }

  let charset = "utf-8";
  for (const parameter of parameters) {
    const match = /^\s*charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s;]+))\s*$/iu.exec(
      parameter,
    );
    const declaredCharset = match?.[1] ?? match?.[2] ?? match?.[3];
    if (declaredCharset) {
      charset = declaredCharset.toLowerCase();
      break;
    }
  }

  if (!/^[a-z0-9._-]{1,40}$/u.test(charset)) {
    throw new PageFetchError(
      "UNSUPPORTED_CHARSET",
      "The remote page declares an unsupported text encoding.",
    );
  }

  return {
    contentType: normalizedMediaType,
    charset,
  };
}

function parseContentLength(value: string | undefined, maxBytes: number): void {
  if (!value) {
    return;
  }

  if (!/^\d+$/u.test(value.trim())) {
    throw new PageFetchError(
      "INVALID_CONTENT_LENGTH",
      "The remote page returned an invalid Content-Length header.",
    );
  }

  const length = Number(value);
  if (!Number.isSafeInteger(length)) {
    throw new PageFetchError(
      "INVALID_CONTENT_LENGTH",
      "The remote page returned an invalid Content-Length header.",
    );
  }

  if (length > maxBytes) {
    throw new PageFetchError(
      "RESPONSE_TOO_LARGE",
      `The remote page exceeds the ${maxBytes}-byte response limit.`,
    );
  }
}

async function nextWithSignal<T>(
  iterator: AsyncIterator<T>,
  signal: AbortSignal,
): Promise<IteratorResult<T>> {
  if (signal.aborted) {
    throw signal.reason;
  }

  return new Promise<IteratorResult<T>>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    iterator.next().then(
      (result) => {
        signal.removeEventListener("abort", onAbort);
        resolve(result);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function readBoundedBody(
  response: HttpTransportResponse,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  const iterator = response.body[Symbol.asyncIterator]();

  try {
    while (true) {
      const result = await nextWithSignal(iterator, signal);
      if (result.done) {
        break;
      }

      if (!(result.value instanceof Uint8Array)) {
        throw new PageFetchError(
          "INVALID_BODY_CHUNK",
          "The remote server returned an unreadable response body.",
        );
      }

      byteLength += result.value.byteLength;
      if (byteLength > maxBytes) {
        throw new PageFetchError(
          "RESPONSE_TOO_LARGE",
          `The remote page exceeds the ${maxBytes}-byte response limit.`,
        );
      }
      chunks.push(result.value);
    }
  } catch (error) {
    void iterator.return?.().catch(() => undefined);
    throw error;
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function decodeBody(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch (cause) {
    throw new PageFetchError(
      "UNSUPPORTED_CHARSET",
      "The remote page declares an unsupported text encoding.",
      { cause },
    );
  }
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function requestValidatedAddress(
  url: URL,
  addresses: readonly ResolvedAddress[],
  transport: HttpTransport,
  signal: AbortSignal,
): Promise<HttpTransportResponse> {
  const headers = Object.freeze({
    accept: "text/html, text/plain;q=0.9",
    "accept-encoding": "identity",
    connection: "close",
    "user-agent": PUBLIC_PAGE_USER_AGENT,
  });

  let lastError: unknown;
  for (const address of addresses) {
    if (signal.aborted) {
      throw signal.reason;
    }
    try {
      return await transport({ url, address, headers, signal });
    } catch (error) {
      if (error instanceof PageFetchError) {
        throw error;
      }
      lastError = error;
    }
  }

  throw new PageFetchError(
    "NETWORK_ERROR",
    "The public page could not be fetched from its validated addresses.",
    { cause: lastError },
  );
}

export async function fetchPublicPage(
  input: string | URL,
  options: FetchPublicPageOptions = {},
): Promise<FetchedPage> {
  const timeoutMs = validateIntegerLimit(
    options.timeoutMs ?? PUBLIC_PAGE_FETCH_LIMITS.timeoutMs,
    "timeoutMs",
    1,
    60_000,
  );
  const maxBytes = validateIntegerLimit(
    options.maxBytes ?? PUBLIC_PAGE_FETCH_LIMITS.maxBytes,
    "maxBytes",
    1,
    10_000_000,
  );
  const maxRedirects = validateIntegerLimit(
    options.maxRedirects ?? PUBLIC_PAGE_FETCH_LIMITS.maxRedirects,
    "maxRedirects",
    0,
    10,
  );

  const controller = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) {
    controller.abort(options.signal.reason);
  } else {
    options.signal?.addEventListener("abort", onExternalAbort, { once: true });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("Public page fetch timed out."));
  }, timeoutMs);

  let current: string | URL = input;
  let requestedUrl: string | undefined;
  let requiredRedirectOrigin = options.allowedRedirectOrigin;
  let crossOriginTransitionAvailable =
    options.allowSinglePublicCrossOriginRedirect === true &&
    requiredRedirectOrigin !== undefined;
  const redirects: Array<{ from: string; to: string; status: number }> = [];

  try {
    while (true) {
      const validated = await validatePublicUrl(current, {
        resolver: options.resolver,
        signal: controller.signal,
      });
      requestedUrl ??= validated.url.href;
      const response = await requestValidatedAddress(
        validated.url,
        validated.addresses,
        options.transport ?? pinnedNodeHttpTransport,
        controller.signal,
      );

      if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
        response.dispose?.();
        throw new PageFetchError(
          "INVALID_STATUS",
          "The remote server returned an invalid HTTP status.",
        );
      }

      if (isRedirectStatus(response.status)) {
        const location = getHeader(response.headers, "location");
        response.dispose?.();
        if (!location) {
          throw new PageFetchError(
            "REDIRECT_WITHOUT_LOCATION",
            "The remote server returned a redirect without a destination.",
          );
        }

        let destination: URL;
        try {
          destination = parsePublicHttpUrl(new URL(location, validated.url));
        } catch (cause) {
          if (cause instanceof UrlSafetyError) {
            throw cause;
          }
          throw new PageFetchError(
            "INVALID_REDIRECT",
            "The remote server returned an invalid redirect destination.",
            { cause },
          );
        }

        if (requiredRedirectOrigin && !haveSameOrigin(requiredRedirectOrigin, destination)) {
          if (!crossOriginTransitionAvailable) {
            throw new PageFetchError(
              "CROSS_ORIGIN_REDIRECT",
              "A discovered page redirected outside its permitted public origin.",
            );
          }
          // The destination is syntactically public here and is fully
          // DNS/address revalidated at the top of the next loop iteration.
          // Consuming the allowance now makes a second origin transition fail
          // closed even when the first destination redirects immediately.
          crossOriginTransitionAvailable = false;
          requiredRedirectOrigin = destination;
        }

        if (redirects.length >= maxRedirects) {
          throw new PageFetchError(
            "TOO_MANY_REDIRECTS",
            `The remote page exceeded the ${maxRedirects}-redirect limit.`,
          );
        }

        redirects.push({
          from: validated.url.href,
          to: destination.href,
          status: response.status,
        });
        current = destination;
        continue;
      }

      if (response.status < 200 || response.status > 299) {
        response.dispose?.();
        throw new PageFetchError(
          "HTTP_STATUS",
          `The remote server returned HTTP ${response.status}.`,
        );
      }

      const contentEncoding = getHeader(response.headers, "content-encoding")?.trim().toLowerCase();
      if (contentEncoding && contentEncoding !== "identity") {
        response.dispose?.();
        throw new PageFetchError(
          "UNSUPPORTED_CONTENT_ENCODING",
          "The remote page ignored the identity-encoding request.",
        );
      }

      let contentType: SupportedPageContentType;
      let charset: string;
      try {
        ({ contentType, charset } = parseContentType(
          getHeader(response.headers, "content-type"),
        ));
        parseContentLength(getHeader(response.headers, "content-length"), maxBytes);
      } catch (error) {
        response.dispose?.();
        throw error;
      }

      let bytes: Uint8Array;
      try {
        bytes = await readBoundedBody(response, maxBytes, controller.signal);
      } finally {
        response.dispose?.();
      }

      return {
        requestedUrl: requestedUrl ?? validated.url.href,
        url: validated.url.href,
        status: response.status,
        contentType,
        text: decodeBody(bytes, charset),
        byteLength: bytes.byteLength,
        fetchedAt: (options.now ?? (() => new Date()))().toISOString(),
        redirects,
      };
    }
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new PageFetchError(
        timedOut ? "TIMEOUT" : "ABORTED",
        timedOut
          ? `The public page did not respond within ${timeoutMs} milliseconds.`
          : "The public page fetch was cancelled.",
        { cause },
      );
    }
    if (cause instanceof PageFetchError || cause instanceof UrlSafetyError) {
      throw cause;
    }
    throw new PageFetchError(
      "NETWORK_ERROR",
      "The public page could not be fetched.",
      { cause },
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}

export interface AcquirePublicSourcePagesOptions
  extends FetchPublicPageOptions {
  readonly maxDiscoveredPages?: number;
  readonly onPageAcquired?: (page: AcquiredSourcePage) => void;
  readonly onPageFailure?: (failure: PageAcquisitionFailure) => void;
  readonly onDiscoveryComplete?: (candidateCount: number) => void;
  readonly onTiming?: (
    stage: "submitted_source_acquisition" | "source_discovery" | "discovered_source_acquisition" | "text_processing",
    durationMs: number,
  ) => void;
}

function acquisitionFailure(
  error: unknown,
  url: string,
): PageAcquisitionFailure {
  if (error instanceof PageFetchError || error instanceof UrlSafetyError) {
    return { url, code: error.code, message: error.message };
  }
  return {
    url,
    code: "FETCH_FAILED",
    message: "The discovered page could not be reviewed.",
  };
}

/**
 * Fetches the submitted page, ranks links found on that page, then reviews at
 * most six same-origin candidates. It is deliberately one level deep and does
 * not recursively crawl links from discovered pages.
 */
export async function acquirePublicSourcePages(
  input: string | URL,
  options: AcquirePublicSourcePagesOptions = {},
): Promise<AcquiredSourceSet> {
  const {
    maxDiscoveredPages,
    onPageAcquired,
    onPageFailure,
    onDiscoveryComplete,
    onTiming,
    ...fetchOptions
  } = options;
  const submittedFetchStartedAt = performance.now();
  const submittedFetched = await fetchPublicPage(input, fetchOptions);
  onTiming?.("submitted_source_acquisition", performance.now() - submittedFetchStartedAt);
  const submittedProcessingStartedAt = performance.now();
  const submitted: AcquiredSourcePage = {
    fetched: submittedFetched,
    extracted: extractFetchedPage(submittedFetched),
  };
  onTiming?.("text_processing", performance.now() - submittedProcessingStartedAt);
  onPageAcquired?.(submitted);
  const discoveryStartedAt = performance.now();
  const candidates = rankSameOriginLinks(
    submittedFetched.url,
    submitted.extracted.links,
    {
      maxPages: maxDiscoveredPages ?? MAX_DISCOVERED_PAGES,
      targetTitle: submitted.extracted.title,
    },
  );
  onTiming?.("source_discovery", performance.now() - discoveryStartedAt);
  onDiscoveryComplete?.(candidates.length);
  const discovered: AcquiredSourcePage[] = [];
  const failures: PageAcquisitionFailure[] = [];
  const finalUrls = new Set([submittedFetched.url]);
  let applicationRedirectAllowanceAssigned = false;

  // Sequential requests keep load on the source site bounded and predictable.
  for (const candidate of candidates) {
    const allowApplicationRedirect =
      candidate.topic === "application" && !applicationRedirectAllowanceAssigned;
    if (allowApplicationRedirect) applicationRedirectAllowanceAssigned = true;
    try {
      const discoveredFetchStartedAt = performance.now();
      const fetched = await fetchPublicPage(candidate.url, {
        ...fetchOptions,
        allowedRedirectOrigin: submittedFetched.url,
        allowSinglePublicCrossOriginRedirect: allowApplicationRedirect,
      });
      onTiming?.("discovered_source_acquisition", performance.now() - discoveredFetchStartedAt);
      if (finalUrls.has(fetched.url)) {
        continue;
      }
      finalUrls.add(fetched.url);
      const discoveredProcessingStartedAt = performance.now();
      discovered.push({
        fetched,
        extracted: extractFetchedPage(fetched),
        discovery: candidate,
      });
      onTiming?.("text_processing", performance.now() - discoveredProcessingStartedAt);
      onPageAcquired?.(discovered.at(-1)!);
    } catch (error) {
      const failure = acquisitionFailure(error, candidate.url);
      failures.push(failure);
      onPageFailure?.(failure);
    }
  }

  return { submitted, discovered, failures };
}
