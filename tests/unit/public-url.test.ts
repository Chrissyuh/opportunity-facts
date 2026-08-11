import { describe, expect, it } from "vitest";

import {
  hasSensitiveUrlQuery,
  isObviouslyPublicHttpUrl,
} from "../../lib/opportunity/public-url";

describe("stored and client-submitted public URL policy", () => {
  it("rejects obvious local, private, metadata, and credential targets", () => {
    for (const value of [
      "http://localhost/page",
      "http://10.0.0.1/page",
      "http://172.20.1.2/page",
      "http://192.168.1.2/page",
      "http://169.254.169.254/latest/meta-data",
      "http://168.63.129.16/machine?comp=goalstate",
      "http://instance-data/latest",
      "http://metadata.google/compute",
      "http://./x",
      "http://../x",
      "http://localhost../x",
      "https://router.local/status",
      "https://intranet.corp/page",
      "https://service.internal/page",
      "http://router/admin",
      "http://printer/status",
      "https://intranet/page",
      "http://router.home.arpa/admin",
      "http://router.localdomain/admin",
      "http://metadata.google.internal/computeMetadata/v1",
      "http://[::1]/page",
      "http://[::ffff:7f00:1]/page",
      "http://[::ffff:a00:1]/page",
      "https://user:secret@program.example/page",
    ]) {
      expect(isObviouslyPublicHttpUrl(value), value).toBe(false);
    }
    expect(isObviouslyPublicHttpUrl("https://program.example/public-facts")).toBe(true);
  });

  it("flags token-like query parameter names before correction packets can be shared", () => {
    expect(hasSensitiveUrlQuery("https://program.example/page?token=secret")).toBe(true);
    expect(hasSensitiveUrlQuery("https://program.example/page?X-Amz-Signature=secret")).toBe(true);
    expect(hasSensitiveUrlQuery("https://program.example/page?apiKey=secret")).toBe(true);
    expect(hasSensitiveUrlQuery("https://program.example/page?accessToken=secret")).toBe(true);
    expect(hasSensitiveUrlQuery("https://program.example/page?authToken=secret")).toBe(true);
    expect(hasSensitiveUrlQuery("https://program.example/page?sessionId=secret")).toBe(true);
    expect(hasSensitiveUrlQuery("https://program.example/page?apikey=secret")).toBe(true);
    expect(hasSensitiveUrlQuery("https://program.example/page?accesstoken=secret")).toBe(true);
    expect(hasSensitiveUrlQuery("https://program.example/page?sessionid=secret")).toBe(true);
    expect(hasSensitiveUrlQuery("https://program.example/page?authorization=secret")).toBe(true);
    expect(hasSensitiveUrlQuery("https://program.example/callback#access_token=SECRET&token_type=bearer")).toBe(true);
    expect(hasSensitiveUrlQuery("https://program.example/callback#sessionId=SECRET")).toBe(true);
    expect(hasSensitiveUrlQuery("https://program.example/page?monkey=lemur")).toBe(false);
    expect(hasSensitiveUrlQuery("https://program.example/page?cycle=2027")).toBe(false);
  });
});
