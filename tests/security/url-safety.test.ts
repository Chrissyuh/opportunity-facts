import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_DNS_RESULTS,
  normalizeUrlHostname,
  parsePublicHttpUrl,
  validatePublicUrl,
} from "../../lib/analysis/url-safety";
import type { DnsResolver } from "../../lib/analysis/types";

describe("public URL parsing", () => {
  it.each(["file:///etc/passwd", "ftp://example.com/file", "data:text/plain,hello", "javascript:alert(1)"])(
    "rejects the unsupported protocol in %s",
    (url) => {
      expect(() => parsePublicHttpUrl(url)).toThrowError(
        expect.objectContaining({ code: "UNSUPPORTED_PROTOCOL" }),
      );
    },
  );

  it.each([
    "http://example.com:22/program",
    "http://example.com:8080/program",
    "https://example.com:8443/program",
    "https://example.com:80/program",
  ])("rejects a non-default public destination port in %s", (url) => {
    expect(() => parsePublicHttpUrl(url)).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_PORT" }),
    );
  });

  it.each([
    ["http://example.com:80/program", "http://example.com/program"],
    ["https://example.com:443/program", "https://example.com/program"],
  ])("normalizes an explicit protocol-default port in %s", (url, expected) => {
    expect(parsePublicHttpUrl(url).href).toBe(expected);
  });

  it.each([
    "http://localhost/",
    "http://LOCALHOST./",
    "http://api.localhost/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://instance-data/latest/meta-data/",
    "https://router.local/status",
    "https://intranet.corp/page",
    "https://service.internal/page",
    "http://router/admin",
    "http://printer/status",
    "https://intranet/page",
    "http://router.home.arpa/admin",
    "http://router.localdomain/admin",
  ])("rejects local or metadata hostname %s", (url) => {
    expect(() => parsePublicHttpUrl(url)).toThrowError(
      expect.objectContaining({ code: "BLOCKED_HOSTNAME" }),
    );
  });

  it("rejects credentials even when the destination hostname looks public", () => {
    expect(() => parsePublicHttpUrl("https://user:secret@example.com/program")).toThrowError(
      expect.objectContaining({ code: "URL_CREDENTIALS" }),
    );
  });

  it.each([
    "https://example.com/program?apiKey=secret",
    "https://example.com/program?accessToken=secret",
    "https://example.com/program?authToken=secret",
    "https://example.com/program?sessionId=secret",
    "https://example.com/program?apikey=secret",
    "https://example.com/program?accesstoken=secret",
    "https://example.com/program?sessionid=secret",
    "https://example.com/program?authorization=secret",
  ])("rejects common sensitive query key %s", (url) => {
    expect(() => parsePublicHttpUrl(url)).toThrowError(
      expect.objectContaining({ code: "URL_SENSITIVE_QUERY" }),
    );
  });

  it.each([
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://10.0.0.1/",
    "http://172.16.1.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://168.63.129.16/machine?comp=goalstate",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://224.0.0.1/",
    "http://192.0.2.1/",
  ])("rejects non-public IPv4 target %s", (url) => {
    expect(() => parsePublicHttpUrl(url)).toThrowError(
      expect.objectContaining({ code: "BLOCKED_IP" }),
    );
  });

  it.each([
    "http://[::1]/",
    "http://[::]/",
    "http://[fc00::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[2001:db8::1]/",
  ])("rejects non-public IPv6 target %s", (url) => {
    expect(() => parsePublicHttpUrl(url)).toThrowError(
      expect.objectContaining({ code: "BLOCKED_IP" }),
    );
  });

  it("normalizes brackets, case, and trailing dots in hostnames", () => {
    expect(normalizeUrlHostname("EXAMPLE.COM.")).toBe("example.com");
    expect(normalizeUrlHostname("[2001:4860:4860::8888]")).toBe(
      "2001:4860:4860::8888",
    );
  });

  it("drops fragments because they are not part of the network request", () => {
    expect(parsePublicHttpUrl("https://example.com/program#fees").href).toBe(
      "https://example.com/program",
    );
  });

  it("strips recognized marketing identifiers while preserving functional query parameters", () => {
    expect(
      parsePublicHttpUrl(
        "https://example.com/apply?utm_source=newsletter&UTM_Campaign=fall&gclid=google&fbclid=meta&msclkid=microsoft&attribution_id=uuid&source=school&cohort=fall",
      ).href,
    ).toBe("https://example.com/apply?source=school&cohort=fall");
  });

  it("rejects sensitive query keys instead of stripping them beside tracking keys", () => {
    expect(() =>
      parsePublicHttpUrl(
        "https://example.com/apply?utm_source=newsletter&accessToken=secret",
      ),
    ).toThrowError(expect.objectContaining({ code: "URL_SENSITIVE_QUERY" }));
  });
});

describe("DNS result validation", () => {
  it("accepts and returns only validated public answers", async () => {
    const resolver = vi.fn<DnsResolver>(async () => [
      { address: "93.184.216.34", family: 4 as const },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 as const },
      { address: "93.184.216.34", family: 4 as const },
    ]);

    const result = await validatePublicUrl("https://Example.COM./program", { resolver });

    expect(resolver).toHaveBeenCalledWith("example.com", undefined);
    expect(result.addresses).toHaveLength(2);
    expect(result.hostname).toBe("example.com");
  });

  it("rejects a hostname when any DNS answer is private", async () => {
    const resolver: DnsResolver = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.7", family: 4 },
    ];

    await expect(validatePublicUrl("https://example.com", { resolver })).rejects.toMatchObject({
      code: "BLOCKED_IP",
    });
  });

  it("rejects IPv4-mapped private IPv6 DNS answers", async () => {
    const resolver: DnsResolver = async () => [
      { address: "::ffff:169.254.169.254", family: 6 },
    ];

    await expect(validatePublicUrl("https://example.com", { resolver })).rejects.toMatchObject({
      code: "BLOCKED_IP",
    });
  });

  it("rejects the Azure host-node platform address returned by DNS", async () => {
    const resolver: DnsResolver = async () => [
      { address: "168.63.129.16", family: 4 },
    ];

    await expect(validatePublicUrl("https://example.com", { resolver })).rejects.toMatchObject({
      code: "BLOCKED_IP",
    });
  });

  it("rejects empty, excessive, invalid, and family-mismatched DNS answers", async () => {
    const empty: DnsResolver = async () => [];
    const excessive: DnsResolver = async () =>
      Array.from({ length: MAX_DNS_RESULTS + 1 }, (_, index) => ({
        address: `8.8.8.${(index % 200) + 1}`,
        family: 4 as const,
      }));
    const invalid: DnsResolver = async () => [{ address: "not-an-ip", family: 4 }];
    const mismatched: DnsResolver = async () => [{ address: "8.8.8.8", family: 6 }];

    await expect(validatePublicUrl("https://example.com", { resolver: empty })).rejects.toMatchObject({ code: "DNS_NO_RESULTS" });
    await expect(validatePublicUrl("https://example.com", { resolver: excessive })).rejects.toMatchObject({ code: "DNS_TOO_MANY_RESULTS" });
    await expect(validatePublicUrl("https://example.com", { resolver: invalid })).rejects.toMatchObject({ code: "INVALID_DNS_RESULT" });
    await expect(validatePublicUrl("https://example.com", { resolver: mismatched })).rejects.toMatchObject({ code: "INVALID_DNS_RESULT" });
  });
});
