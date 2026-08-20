import "server-only";

import { lookup } from "node:dns/promises";

import ipaddr from "ipaddr.js";
import {
  hasSensitiveUrlQuery,
  isBlockedPublicHostname,
  isNonPublicAddressLiteral,
  normalizePublicUrlHostname,
} from "../opportunity/public-url";

import type {
  DnsResolver,
  IpFamily,
  ResolvedAddress,
  ValidatedPublicUrl,
} from "./types";

export const MAX_URL_LENGTH = 2_048;
export const MAX_DNS_RESULTS = 32;

const KNOWN_TRACKING_QUERY_KEYS = new Set([
  "attribution_id",
  "dclid",
  "fbclid",
  "gclid",
  "igshid",
  "li_fat_id",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "ttclid",
  "twclid",
]);

export type UrlSafetyErrorCode =
  | "INVALID_URL"
  | "URL_TOO_LONG"
  | "UNSUPPORTED_PROTOCOL"
  | "UNSUPPORTED_PORT"
  | "URL_CREDENTIALS"
  | "URL_SENSITIVE_QUERY"
  | "MISSING_HOSTNAME"
  | "BLOCKED_HOSTNAME"
  | "BLOCKED_IP"
  | "DNS_LOOKUP_FAILED"
  | "DNS_NO_RESULTS"
  | "DNS_TOO_MANY_RESULTS"
  | "INVALID_DNS_RESULT"
  | "VALIDATION_ABORTED";

export class UrlSafetyError extends Error {
  readonly code: UrlSafetyErrorCode;

  constructor(code: UrlSafetyErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UrlSafetyError";
    this.code = code;
  }
}

function abortError(): UrlSafetyError {
  return new UrlSafetyError(
    "VALIDATION_ABORTED",
    "URL validation was cancelled before it completed.",
  );
}

async function awaitWithSignal<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    throw abortError();
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

export function normalizeUrlHostname(hostname: string): string {
  return normalizePublicUrlHostname(hostname);
}

function stripKnownTrackingQuery(url: URL): void {
  const keysToDelete = new Set<string>();
  for (const key of url.searchParams.keys()) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith("utm_") || KNOWN_TRACKING_QUERY_KEYS.has(normalized)) {
      keysToDelete.add(key);
    }
  }
  for (const key of keysToDelete) {
    url.searchParams.delete(key);
  }
}

export function parsePublicHttpUrl(input: string | URL): URL {
  const raw = input instanceof URL ? input.href : input.trim();

  if (raw.length === 0) {
    throw new UrlSafetyError("INVALID_URL", "Enter an absolute public URL.");
  }

  if (raw.length > MAX_URL_LENGTH) {
    throw new UrlSafetyError(
      "URL_TOO_LONG",
      `The URL exceeds the ${MAX_URL_LENGTH}-character limit.`,
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch (cause) {
    throw new UrlSafetyError(
      "INVALID_URL",
      "Enter a valid absolute public URL.",
      { cause },
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlSafetyError(
      "UNSUPPORTED_PROTOCOL",
      "Only public HTTP and HTTPS URLs can be reviewed.",
    );
  }
  // URL normalizes explicit default :80/:443 ports to an empty string. Other
  // ports would turn this public-page feature into a blind arbitrary-port
  // request primitive even when the destination address itself is public.
  if (url.port !== "") {
    throw new UrlSafetyError(
      "UNSUPPORTED_PORT",
      "Only the standard port for public HTTP or HTTPS pages can be reviewed.",
    );
  }

  if (url.username !== "" || url.password !== "") {
    throw new UrlSafetyError(
      "URL_CREDENTIALS",
      "URLs containing usernames or passwords are not accepted.",
    );
  }
  if (hasSensitiveUrlQuery(url.href)) {
    throw new UrlSafetyError(
      "URL_SENSITIVE_QUERY",
      "URLs with token-, key-, signature-, session-, auth-, code-, or secret-like query parameters are not accepted.",
    );
  }

  // Marketing identifiers are unnecessary for reviewing the public resource.
  // Remove a deliberately narrow, recognized set before transport and before
  // the canonical URL can become source/evidence metadata. Ambiguous keys such
  // as `source`, `ref`, and routing/form parameters are preserved. Sensitive
  // keys are rejected above rather than silently sanitized.
  stripKnownTrackingQuery(url);

  const hostname = normalizeUrlHostname(url.hostname);
  if (hostname === "") {
    throw new UrlSafetyError("MISSING_HOSTNAME", "The URL needs a hostname.");
  }

  if (isBlockedPublicHostname(hostname)) {
    throw new UrlSafetyError(
      "BLOCKED_HOSTNAME",
      "Local and metadata service hostnames cannot be reviewed.",
    );
  }

  if (ipaddr.isValid(hostname)) {
    assertPublicIpAddress(hostname);
  }

  // Fragments are client-side identifiers and are never sent in an HTTP
  // request. Removing them gives fetching, IDs, and redirect logs one canonical
  // representation of the network resource.
  url.hash = "";
  return url;
}

export function assertPublicIpAddress(address: string): void {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(address);
  } catch (cause) {
    throw new UrlSafetyError(
      "INVALID_DNS_RESULT",
      "DNS returned an invalid IP address.",
      { cause },
    );
  }

  if (parsed.kind() === "ipv6") {
    const ipv6Address = parsed as ipaddr.IPv6;
    if (ipv6Address.isIPv4MappedAddress()) {
      parsed = ipv6Address.toIPv4Address();
    }
  }

  if (parsed.range() !== "unicast" || isNonPublicAddressLiteral(address)) {
    throw new UrlSafetyError(
      "BLOCKED_IP",
      "The URL resolves to a non-public network address.",
    );
  }
}

function normalizeResolvedAddress(result: ResolvedAddress): ResolvedAddress {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(result.address);
  } catch (cause) {
    throw new UrlSafetyError(
      "INVALID_DNS_RESULT",
      "DNS returned an invalid IP address.",
      { cause },
    );
  }

  const parsedFamily: IpFamily = parsed.kind() === "ipv4" ? 4 : 6;
  if (parsedFamily !== result.family) {
    throw new UrlSafetyError(
      "INVALID_DNS_RESULT",
      "DNS returned an address with an inconsistent IP family.",
    );
  }

  assertPublicIpAddress(result.address);
  return {
    address: parsed.toNormalizedString(),
    family: parsedFamily,
  };
}

export const defaultDnsResolver: DnsResolver = async (hostname) => {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((result) => {
    if (result.family !== 4 && result.family !== 6) {
      throw new UrlSafetyError(
        "INVALID_DNS_RESULT",
        "DNS returned an address with an unsupported IP family.",
      );
    }
    return {
      address: result.address,
      family: result.family,
    };
  });
};

export interface ValidatePublicUrlOptions {
  readonly resolver?: DnsResolver;
  readonly signal?: AbortSignal;
}

export async function validatePublicUrl(
  input: string | URL,
  options: ValidatePublicUrlOptions = {},
): Promise<ValidatedPublicUrl> {
  const url = parsePublicHttpUrl(input);
  const hostname = normalizeUrlHostname(url.hostname);

  if (ipaddr.isValid(hostname)) {
    const parsed = ipaddr.parse(hostname);
    const family: IpFamily = parsed.kind() === "ipv4" ? 4 : 6;
    return {
      url,
      hostname,
      addresses: [{ address: parsed.toNormalizedString(), family }],
    };
  }

  let results: readonly ResolvedAddress[];
  try {
    results = await awaitWithSignal(
      (options.resolver ?? defaultDnsResolver)(hostname, options.signal),
      options.signal,
    );
  } catch (cause) {
    if (cause instanceof UrlSafetyError) {
      throw cause;
    }

    throw new UrlSafetyError(
      "DNS_LOOKUP_FAILED",
      "The URL hostname could not be resolved.",
      { cause },
    );
  }

  if (results.length === 0) {
    throw new UrlSafetyError(
      "DNS_NO_RESULTS",
      "The URL hostname did not resolve to an address.",
    );
  }

  if (results.length > MAX_DNS_RESULTS) {
    throw new UrlSafetyError(
      "DNS_TOO_MANY_RESULTS",
      "The URL hostname returned too many addresses to validate safely.",
    );
  }

  // Reject the entire hostname when any answer is non-public. Choosing only a
  // public answer would leave a round-robin/rebinding path to a private target.
  const unique = new Map<string, ResolvedAddress>();
  for (const result of results) {
    const normalized = normalizeResolvedAddress(result);
    unique.set(`${normalized.family}:${normalized.address}`, normalized);
  }

  return {
    url,
    hostname,
    addresses: [...unique.values()],
  };
}

export function normalizedOrigin(input: string | URL): string {
  const url = parsePublicHttpUrl(input);
  const hostname = normalizeUrlHostname(url.hostname);
  const port =
    url.port || (url.protocol === "https:" ? "443" : url.protocol === "http:" ? "80" : "");
  const hostForOrigin = hostname.includes(":") ? `[${hostname}]` : hostname;
  return `${url.protocol}//${hostForOrigin}:${port}`;
}

export function haveSameOrigin(left: string | URL, right: string | URL): boolean {
  return normalizedOrigin(left) === normalizedOrigin(right);
}

export function ipAddressesEqual(left: string, right: string): boolean {
  try {
    const leftAddress = ipaddr.process(left);
    const rightAddress = ipaddr.process(right);
    return (
      leftAddress.kind() === rightAddress.kind() &&
      leftAddress.toNormalizedString() === rightAddress.toNormalizedString()
    );
  } catch {
    return false;
  }
}
