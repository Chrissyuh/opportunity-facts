import { describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";

vi.mock("server-only", () => ({}));

import {
  acquirePublicSourcePages,
  fetchPublicPage,
  pinnedNodeHttpTransport,
  PUBLIC_PAGE_USER_AGENT,
} from "../../lib/analysis/fetch";
import type {
  DnsResolver,
  HttpTransport,
  HttpTransportResponse,
} from "../../lib/analysis/types";

const publicResolver: DnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
];

function body(...chunks: string[]): AsyncIterable<Uint8Array> {
  return (async function* generateBody() {
    for (const chunk of chunks) {
      yield new TextEncoder().encode(chunk);
    }
  })();
}

function response(
  status: number,
  headers: HttpTransportResponse["headers"],
  ...chunks: string[]
): HttpTransportResponse {
  return { status, headers, body: body(...chunks) };
}

describe("bounded public page fetching", () => {
  it("connects to the pinned address while preserving the original HTTP Host", async () => {
    let receivedHost = "";
    let receivedPath = "";
    const server = createServer((request, response) => {
      receivedHost = request.headers.host ?? "";
      receivedPath = request.url ?? "";
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("pinned transport reached");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP listener address.");
      const controller = new AbortController();
      const response = await pinnedNodeHttpTransport({
        url: new URL(`http://attacker.example:${address.port}/proof?source=pinned`),
        address: { address: "127.0.0.1", family: 4 },
        headers: { accept: "text/plain", connection: "close" },
        signal: controller.signal,
      });
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.body) chunks.push(chunk);
      response.dispose?.();

      expect(receivedHost).toBe(`attacker.example:${address.port}`);
      expect(receivedPath).toBe("/proof?source=pinned");
      expect(new TextDecoder().decode(Buffer.concat(chunks))).toBe("pinned transport reached");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("uses a validated address and sends only fixed anonymous request headers", async () => {
    const transport: HttpTransport = vi.fn(async (request) => {
      expect(request.address).toEqual({ address: "93.184.216.34", family: 4 });
      expect(request.headers).toEqual({
        accept: "text/html, text/plain;q=0.9",
        "accept-encoding": "identity",
        connection: "close",
        "user-agent": PUBLIC_PAGE_USER_AGENT,
      });
      expect(request.headers).not.toHaveProperty("cookie");
      expect(request.headers).not.toHaveProperty("authorization");
      return response(
        200,
        { "content-type": "text/html; charset=utf-8" },
        "<main>Public program facts</main>",
      );
    });

    const page = await fetchPublicPage("https://example.com/program", {
      resolver: publicResolver,
      transport,
      now: () => new Date("2026-08-10T12:00:00.000Z"),
    });

    expect(page).toMatchObject({
      requestedUrl: "https://example.com/program",
      url: "https://example.com/program",
      contentType: "text/html",
      text: "<main>Public program facts</main>",
      fetchedAt: "2026-08-10T12:00:00.000Z",
      redirects: [],
    });
    expect(page.byteLength).toBeGreaterThan(0);
  });

  it("resolves relative redirects and validates the destination before the next request", async () => {
    const requestedUrls: string[] = [];
    const transport: HttpTransport = async ({ url }) => {
      requestedUrls.push(url.href);
      return requestedUrls.length === 1
        ? response(302, { location: "../facts?year=2027" })
        : response(200, { "content-type": "text/plain" }, "Deadline: March 14");
    };

    const page = await fetchPublicPage("https://example.com/apply/start", {
      resolver: publicResolver,
      transport,
    });

    expect(requestedUrls).toEqual([
      "https://example.com/apply/start",
      "https://example.com/facts?year=2027",
    ]);
    expect(page.url).toBe("https://example.com/facts?year=2027");
    expect(page.redirects).toEqual([
      {
        from: "https://example.com/apply/start",
        to: "https://example.com/facts?year=2027",
        status: 302,
      },
    ]);
  });

  it("blocks a redirect to a private literal before making another request", async () => {
    const transport = vi.fn<HttpTransport>(async () =>
      response(302, { location: "http://169.254.169.254/latest/meta-data/" }),
    );

    await expect(
      fetchPublicPage("https://example.com/program", {
        resolver: publicResolver,
        transport,
      }),
    ).rejects.toMatchObject({ code: "BLOCKED_IP" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("blocks a redirect to a non-default public port before making another request", async () => {
    const transport = vi.fn<HttpTransport>(async () =>
      response(302, { location: "https://example.com:8443/program" }),
    );

    await expect(
      fetchPublicPage("https://example.com/program", {
        resolver: publicResolver,
        transport,
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_PORT" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("blocks a redirect whose DNS answer changes to a private address", async () => {
    const resolver: DnsResolver = async (hostname) =>
      hostname === "internal.example"
        ? [{ address: "10.1.2.3", family: 4 }]
        : [{ address: "93.184.216.34", family: 4 }];
    const transport = vi.fn<HttpTransport>(async () =>
      response(307, { location: "https://internal.example/admin" }),
    );

    await expect(
      fetchPublicPage("https://example.com/program", { resolver, transport }),
    ).rejects.toMatchObject({ code: "BLOCKED_IP" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("re-resolves and blocks same-host DNS rebinding on a redirect", async () => {
    let resolution = 0;
    const resolver: DnsResolver = async () => {
      resolution += 1;
      return resolution === 1
        ? [{ address: "93.184.216.34", family: 4 }]
        : [{ address: "127.0.0.1", family: 4 }];
    };
    const transport = vi.fn<HttpTransport>(async () =>
      response(302, { location: "/redirected" }),
    );

    await expect(
      fetchPublicPage("https://example.com/program", { resolver, transport }),
    ).rejects.toMatchObject({ code: "BLOCKED_IP" });
    expect(resolution).toBe(2);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("can require discovered-page redirects to remain on the submitted origin", async () => {
    const transport = vi.fn<HttpTransport>(async () =>
      response(302, { location: "https://outside.example/privacy" }),
    );

    await expect(
      fetchPublicPage("https://example.com/privacy", {
        resolver: publicResolver,
        transport,
        allowedRedirectOrigin: "https://example.com/program",
      }),
    ).rejects.toMatchObject({ code: "CROSS_ORIGIN_REDIRECT" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("rejects an oversized declared response before reading it", async () => {
    const dispose = vi.fn();
    const transport: HttpTransport = async () => ({
      status: 200,
      headers: {
        "content-type": "text/html",
        "content-length": "101",
      },
      body: body("small body"),
      dispose,
    });

    await expect(
      fetchPublicPage("https://example.com", {
        resolver: publicResolver,
        transport,
        maxBytes: 100,
      }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("stops a streamed response as soon as the byte limit is crossed", async () => {
    const dispose = vi.fn();
    const transport: HttpTransport = async () => ({
      status: 200,
      headers: { "content-type": "text/plain" },
      body: body("12345", "67890"),
      dispose,
    });

    await expect(
      fetchPublicPage("https://example.com", {
        resolver: publicResolver,
        transport,
        maxBytes: 9,
      }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
    expect(dispose).toHaveBeenCalled();
  });

  it.each([
    ["application/pdf", "UNSUPPORTED_CONTENT_TYPE"],
    [undefined, "MISSING_CONTENT_TYPE"],
  ])("rejects content type %s", async (contentType, code) => {
    const transport: HttpTransport = async () =>
      response(200, { "content-type": contentType }, "not accepted");

    await expect(
      fetchPublicPage("https://example.com", { resolver: publicResolver, transport }),
    ).rejects.toMatchObject({ code });
  });

  it("rejects compressed content because the requested byte limit applies to identity bytes", async () => {
    const transport: HttpTransport = async () =>
      response(
        200,
        { "content-type": "text/html", "content-encoding": "gzip" },
        "compressed data",
      );

    await expect(
      fetchPublicPage("https://example.com", { resolver: publicResolver, transport }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CONTENT_ENCODING" });
  });

  it("enforces one total timeout even when DNS never settles", async () => {
    const resolver: DnsResolver = () => new Promise(() => undefined);
    vi.useFakeTimers();
    try {
      const fetchResult = fetchPublicPage("https://example.com", {
        resolver,
        timeoutMs: 10,
      });
      const timeoutExpectation = expect(fetchResult).rejects.toEqual(
        expect.objectContaining({ code: "TIMEOUT" }),
      );
      await vi.advanceTimersByTimeAsync(10);
      await timeoutExpectation;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("bounded source-page acquisition", () => {
  it("fetches the submitted page plus at most six ranked same-origin pages", async () => {
    const links = Array.from(
      { length: 10 },
      (_, index) => `<a href="/faq/${index}">FAQ ${index}</a>`,
    ).join("");
    const transport = vi.fn<HttpTransport>(async ({ url }) =>
      url.pathname === "/program"
        ? response(200, { "content-type": "text/html" }, `<main>${links}</main>`)
        : response(
            200,
            { "content-type": "text/html" },
            `<main><p>Facts from ${url.pathname}</p><a href="/rules">Rules</a></main>`,
          ),
    );

    const result = await acquirePublicSourcePages("https://example.com/program", {
      resolver: publicResolver,
      transport,
      maxDiscoveredPages: 99,
    });

    expect(transport).toHaveBeenCalledTimes(7);
    expect(result.submitted.extracted.pageType).toBe("user_supplied");
    expect(result.discovered).toHaveLength(6);
    expect(result.discovered.every((page) => page.extracted.pageType === "user_supplied")).toBe(
      true,
    );
    expect(result.failures).toEqual([]);
    expect(result.discovered.every((page) => page.discovery?.topic === "faq")).toBe(
      true,
    );
  });

  it("records a discovered-page failure without discarding successful pages", async () => {
    const transport: HttpTransport = async ({ url }) => {
      if (url.pathname === "/program") {
        return response(
          200,
          { "content-type": "text/html" },
          '<main><a href="/faq">FAQ</a><a href="/privacy">Privacy policy</a></main>',
        );
      }
      return url.pathname === "/faq"
        ? response(503, { "content-type": "text/plain" }, "Unavailable")
        : response(200, { "content-type": "text/plain" }, "Privacy facts");
    };

    const result = await acquirePublicSourcePages("https://example.com/program", {
      resolver: publicResolver,
      transport,
    });

    expect(result.discovered).toHaveLength(1);
    expect(result.discovered[0]?.fetched.url).toBe("https://example.com/privacy");
    expect(result.failures).toEqual([
      expect.objectContaining({
        url: "https://example.com/faq",
        code: "HTTP_STATUS",
      }),
    ]);
  });

  it("allows one ranked application candidate to transition to a revalidated public form origin", async () => {
    const requestedUrls: string[] = [];
    const transport: HttpTransport = async ({ url }) => {
      requestedUrls.push(url.href);
      if (url.pathname === "/program") {
        return response(
          200,
          { "content-type": "text/html" },
          '<main><a href="/faq">FAQ</a><a href="/apply">Apply now</a></main>',
        );
      }
      if (url.hostname === "example.com" && url.pathname === "/faq") {
        return response(302, { location: "https://outside.example/faq" });
      }
      if (url.hostname === "example.com" && url.pathname === "/apply") {
        return response(302, {
          location:
            "https://forms.example/start?attribution_id=tracking-uuid&utm_source=program&cohort=fall",
        });
      }
      if (
        url.hostname === "forms.example" &&
        url.pathname === "/start" &&
        url.search === "?cohort=fall"
      ) {
        return response(302, { location: "/current-cycle" });
      }
      return response(
        200,
        { "content-type": "text/html" },
        "<main>Applications close September 15. Interviews follow review.</main>",
      );
    };

    const result = await acquirePublicSourcePages("https://example.com/program", {
      resolver: publicResolver,
      transport,
    });

    expect(result.discovered).toHaveLength(1);
    expect(result.discovered[0]).toMatchObject({
      fetched: {
        url: "https://forms.example/current-cycle",
        redirects: [
          expect.objectContaining({
            to: "https://forms.example/start?cohort=fall",
          }),
          expect.objectContaining({ to: "https://forms.example/current-cycle" }),
        ],
      },
      discovery: { topic: "application" },
    });
    expect(result.discovered[0]?.extracted.text).toContain("Applications close September 15");
    expect(result.failures).toContainEqual(
      expect.objectContaining({ url: "https://example.com/faq", code: "CROSS_ORIGIN_REDIRECT" }),
    );
    expect(requestedUrls).not.toContain("https://outside.example/faq");
    expect(requestedUrls).toContain("https://forms.example/start?cohort=fall");
    expect(requestedUrls).toContain("https://forms.example/current-cycle");
    expect(requestedUrls.join("\n")).not.toMatch(/attribution_id|utm_source/u);
  });

  it("blocks a second cross-origin transition after an application form origin is pinned", async () => {
    const requestedUrls: string[] = [];
    const transport: HttpTransport = async ({ url }) => {
      requestedUrls.push(url.href);
      if (url.pathname === "/program") {
        return response(
          200,
          { "content-type": "text/html" },
          '<main><a href="/apply">Application</a></main>',
        );
      }
      if (url.hostname === "example.com") {
        return response(302, { location: "https://forms.example/start" });
      }
      return response(302, { location: "https://second-form-origin.example/final" });
    };

    const result = await acquirePublicSourcePages("https://example.com/program", {
      resolver: publicResolver,
      transport,
    });

    expect(result.discovered).toEqual([]);
    expect(result.failures).toContainEqual(
      expect.objectContaining({ url: "https://example.com/apply", code: "CROSS_ORIGIN_REDIRECT" }),
    );
    expect(requestedUrls).toEqual([
      "https://example.com/program",
      "https://example.com/apply",
      "https://forms.example/start",
    ]);
  });

  it("DNS-revalidates the application form origin before connecting", async () => {
    const resolver = vi.fn<DnsResolver>(async (hostname) =>
      hostname === "forms.example"
        ? [{ address: "10.20.30.40", family: 4 }]
        : [{ address: "93.184.216.34", family: 4 }],
    );
    const requestedUrls: string[] = [];
    const transport: HttpTransport = async ({ url }) => {
      requestedUrls.push(url.href);
      return url.pathname === "/program"
        ? response(
            200,
            { "content-type": "text/html" },
            '<main><a href="/apply">Apply</a></main>',
          )
        : response(302, { location: "https://forms.example/application" });
    };

    const result = await acquirePublicSourcePages("https://example.com/program", {
      resolver,
      transport,
    });

    expect(resolver).toHaveBeenCalledWith("forms.example", expect.any(AbortSignal));
    expect(requestedUrls).toEqual([
      "https://example.com/program",
      "https://example.com/apply",
    ]);
    expect(result.failures).toContainEqual(
      expect.objectContaining({ url: "https://example.com/apply", code: "BLOCKED_IP" }),
    );
  });

  it("assigns the cross-origin allowance to at most one application candidate", async () => {
    const requestedUrls: string[] = [];
    const transport: HttpTransport = async ({ url }) => {
      requestedUrls.push(url.href);
      if (url.pathname === "/program") {
        return response(
          200,
          { "content-type": "text/html" },
          '<main><a href="/apply-primary">Apply primary</a><a href="/apply-backup">Apply backup</a></main>',
        );
      }
      if (url.pathname === "/apply-primary") {
        return response(200, { "content-type": "text/plain" }, "Primary application page");
      }
      return response(302, { location: "https://forms.example/backup" });
    };

    const result = await acquirePublicSourcePages("https://example.com/program", {
      resolver: publicResolver,
      transport,
    });

    expect(result.discovered.map((page) => page.fetched.url)).toEqual([
      "https://example.com/apply-primary",
    ]);
    expect(result.failures).toContainEqual(
      expect.objectContaining({
        url: "https://example.com/apply-backup",
        code: "CROSS_ORIGIN_REDIRECT",
      }),
    );
    expect(requestedUrls).not.toContain("https://forms.example/backup");
  });
});
