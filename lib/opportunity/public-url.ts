import ipaddr from "ipaddr.js";

export const BLOCKED_PUBLIC_HOSTNAMES = new Set([
  "instance-data",
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google",
  "metadata.google.internal",
]);

const BLOCKED_LOCAL_HOSTNAME_SUFFIXES = [
  ".localhost",
  ".localdomain",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".home.arpa",
  ".corp",
] as const;

const BLOCKED_PLATFORM_SERVICE_ADDRESSES = new Set([
  "168.63.129.16", // Azure host-node WireServer/platform virtual IP.
]);

export function normalizePublicUrlHostname(hostname: string): string {
  const withoutBrackets =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;
  return withoutBrackets.replace(/\.+$/u, "").toLowerCase();
}

export function isNonPublicAddressLiteral(hostname: string): boolean {
  if (!ipaddr.isValid(hostname)) return false;
  let address = ipaddr.parse(hostname);
  if (address.kind() === "ipv6" && (address as ipaddr.IPv6).isIPv4MappedAddress()) {
    address = (address as ipaddr.IPv6).toIPv4Address();
  }
  return (
    address.range() !== "unicast" ||
    BLOCKED_PLATFORM_SERVICE_ADDRESSES.has(address.toString())
  );
}

export function isBlockedPublicHostname(hostname: string): boolean {
  const normalized = normalizePublicUrlHostname(hostname);
  return (
    normalized === "" ||
    (!normalized.includes(".") && !ipaddr.isValid(normalized)) ||
    BLOCKED_PUBLIC_HOSTNAMES.has(normalized) ||
    BLOCKED_LOCAL_HOSTNAME_SUFFIXES.some(
      (suffix) => normalized === suffix.slice(1) || normalized.endsWith(suffix),
    )
  );
}

export function isObviouslyPublicHttpUrl(value: string): boolean {
  try {
    if (value.length > 2_048) return false;
    const url = new URL(value);
    const hostname = normalizePublicUrlHostname(url.hostname);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      !isBlockedPublicHostname(hostname) &&
      !isNonPublicAddressLiteral(hostname)
    );
  } catch {
    return false;
  }
}

export function hasSensitiveUrlQuery(value: string): boolean {
  try {
    const url = new URL(value);
    const rawFragment = url.hash.slice(1);
    let fragment = rawFragment;
    try {
      fragment = decodeURIComponent(rawFragment);
    } catch {
      // Retain the raw fragment so malformed escaping cannot bypass key checks.
    }
    const fragmentKeys = fragment
      ? [...new URLSearchParams(fragment).keys(), fragment]
      : [];
    return [...url.searchParams.keys(), ...fragmentKeys].some((key) => {
      const words = key
        .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .filter(Boolean);
      const compact = key.toLowerCase().replace(/[^a-z0-9]+/gu, "");
      return (
        words.some((word) =>
          [
            "token",
            "key",
            "signature",
            "sig",
            "auth",
            "authorization",
            "credential",
            "password",
            "session",
            "secret",
            "code",
            "jwt",
          ].includes(word),
        ) ||
        [
          "apikey",
          "accesskey",
          "accesstoken",
          "authtoken",
          "refreshtoken",
          "idtoken",
          "sessionid",
          "clientsecret",
          "xamzsignature",
          "xamzcredential",
          "xamzsecuritytoken",
        ].includes(compact)
      );
    });
  } catch {
    return false;
  }
}
