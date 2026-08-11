import { expect, test as base, type Page } from "@playwright/test";

export const appOrigin = "http://127.0.0.1:4387";

export const test = base.extend({
  page: async ({ page }, provide) => {
    const externalRequests: string[] = [];
    const runtimeErrors: string[] = [];
    const failedRequests: string[] = [];
    const errorResponses: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => runtimeErrors.push(`page: ${error.message}`));
    page.on("requestfailed", (request) => {
      const url = new URL(request.url());
      const failure = request.failure()?.errorText ?? "unknown failure";
      if (
        url.origin === appOrigin &&
        failure !== "net::ERR_ABORTED" &&
        failure !== "NS_BINDING_ABORTED"
      ) {
        failedRequests.push(`${request.method()} ${url.href}: ${failure}`);
      }
    });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin === appOrigin && response.status() >= 400) {
        errorResponses.push(`${response.request().method()} ${url.href}: HTTP ${response.status()}`);
      }
    });

    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== appOrigin) {
        externalRequests.push(url.href);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    await provide(page);
    expect(externalRequests, "Browser tests must not request external resources.").toEqual([]);
    expect(runtimeErrors, "Browser tests must not emit console errors or uncaught page errors.").toEqual([]);
    expect(failedRequests, "Browser tests must not leave unexpected same-origin request failures.").toEqual([]);
    expect(errorResponses, "Browser tests must not receive unexpected same-origin HTTP errors.").toEqual([]);
  },
});

export { expect };

export async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}
