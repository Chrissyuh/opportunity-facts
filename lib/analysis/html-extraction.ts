import "server-only";

import { createHash } from "node:crypto";

import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

import type {
  ExtractedLink,
  ExtractedSourcePage,
  ExtractedTextBlock,
  FetchedPage,
} from "./types";
import { haveSameOrigin, parsePublicHttpUrl } from "./url-safety";

export const DEFAULT_MAX_EXTRACTED_CHARACTERS = 200_000;
export const MAX_EXTRACTED_LINKS = 500;
export const MAX_SOURCE_INPUT_CHARACTERS = 2_000_000;
export const MAX_SOURCE_TITLE_CHARACTERS = 240;
export const MAX_STRUCTURED_METADATA_CHARACTERS = 50_000;

const HIDDEN_NAME_PATTERN =
  /(?:^|\s)(?:d-none|hidden|invisible|offscreen|screen-reader|sr-only|visually-hidden)(?:$|\s)/iu;
const COOKIE_UI_PATTERN =
  /(?:^|[-_\s])(?:cookie|gdpr|consent)[-_\s]*(?:banner|dialog|modal|notice|popup|preferences?)(?:$|[-_\s])/iu;
const INLINE_HIDDEN_PATTERN =
  /(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*(?:0+(?:\.0*)?|\.0+)(?:\s*!important)?\s*(?:;|$)|content-visibility\s*:\s*hidden)/iu;
const NON_OPACITY_HIDDEN_PATTERN =
  /(?:display\s*:\s*none|visibility\s*:\s*hidden|content-visibility\s*:\s*hidden)/iu;
const INITIAL_REVEAL_TRANSFORM_PATTERN =
  /transform\s*:\s*translate(?:3d|x|y)?\s*\([^;)]{1,80}\)/iu;
const HIDDEN_CSS_DECLARATION =
  /(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*(?:0+(?:\.0*)?|\.0+)(?:\s*!important)?\s*(?:;|$)|content-visibility\s*:\s*hidden)/iu;

export function normalizeVisibleText(value: string): string {
  return value
    .replace(/\u00a0/gu, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/\s*\r?\n\s*/gu, " ")
    .trim();
}

function stablePageId(url: string): string {
  return `page-${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
}

function removeCssHiddenElements($: CheerioAPI): void {
  const selectors = new Set<string>();
  $("style").each((_index, element) => {
    const css = $(element).text();
    const rulePattern = /([^{}]+)\{([^{}]*)\}/gu;
    for (const match of css.matchAll(rulePattern)) {
      if (!HIDDEN_CSS_DECLARATION.test(match[2] ?? "")) {
        continue;
      }
      for (const selector of (match[1] ?? "").split(",")) {
        const trimmed = selector.trim();
        if (/^[.#][a-z_][a-z0-9_-]*$/iu.test(trimmed)) {
          selectors.add(trimmed);
        }
      }
    }
  });

  for (const selector of selectors) {
    $(selector).remove();
  }
}

function removeHiddenAndExecutableContent($: CheerioAPI): void {
  removeCssHiddenElements($);
  $(
    "script, style, noscript, template, iframe, frame, object, embed, canvas, svg, audio, video, source, track, input[type='hidden']",
  ).remove();
  $("[hidden]").remove();
  $("[aria-hidden]").each((_index, element) => {
    if (($(element).attr("aria-hidden") ?? "").toLowerCase() === "true") {
      $(element).remove();
    }
  });
  $("[style]").each((_index, element) => {
    const node = $(element);
    const style = node.attr("style") ?? "";
    const tagName = element.type === "tag" ? element.name.toLowerCase() : "";
    const isPrimaryContentContainer =
      tagName === "main" ||
      tagName === "article" ||
      (node.attr("role") ?? "").toLowerCase() === "main" ||
      node.parent().is("main, article, [role='main']") ||
      node.find("footer, nav").length > 0;
    // Some SSR frameworks ship real primary content at opacity 0 with an
    // initial transform, then reveal it during hydration. Preserve only that
    // semantic top-level shell. Arbitrary opacity-hidden nodes stay excluded.
    const isServerRenderedRevealShell =
      isPrimaryContentContainer &&
      !NON_OPACITY_HIDDEN_PATTERN.test(style) &&
      INITIAL_REVEAL_TRANSFORM_PATTERN.test(style);
    if (INLINE_HIDDEN_PATTERN.test(style) && !isServerRenderedRevealShell) {
      $(element).remove();
    }
  });
  $("[class], [id]").each((_index, element) => {
    const names = `${$(element).attr("class") ?? ""} ${$(element).attr("id") ?? ""}`;
    if (HIDDEN_NAME_PATTERN.test(names)) {
      $(element).remove();
    }
  });
}

function jsonLdTypes(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function extractStructuredMetadataBlocks($: CheerioAPI): readonly ExtractedTextBlock[] {
  const blocks: ExtractedTextBlock[] = [];
  const seen = new Set<string>();
  let usedCharacters = 0;
  const push = (kind: ExtractedTextBlock["kind"], value: unknown) => {
    if (typeof value !== "string") return;
    const text = normalizeVisibleText(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    if (usedCharacters + text.length > MAX_STRUCTURED_METADATA_CHARACTERS) return;
    seen.add(key);
    usedCharacters += text.length;
    blocks.push({ kind, text });
  };
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const record = value as Record<string, unknown>;
    if (Array.isArray(record["@graph"])) visit(record["@graph"]);
    const types = jsonLdTypes(record["@type"]);
    if (types.includes("FAQPage")) visit(record.mainEntity);
    if (types.includes("Question")) {
      push("heading", record.name);
      visit(record.acceptedAnswer);
    }
    if (types.includes("Answer")) push("paragraph", record.text);
    if (types.includes("Course")) {
      push("heading", record.name);
      push("paragraph", record.description);
      push("definition", record.courseMode);
      push("definition", record.duration);
      push("definition", record.educationalLevel);
      visit(record.provider);
      visit(record.offers);
    }
    if (types.includes("Offer")) {
      push("definition", record.price);
      push("definition", record.priceCurrency);
    }
    if (types.includes("Organization")) push("definition", record.name);
  };

  $("script[type='application/ld+json']").slice(0, 20).each((_index, element) => {
    const source = $(element).text();
    if (!source || source.length > 250_000) return;
    try {
      visit(JSON.parse(source));
    } catch {
      // Malformed metadata is ignored; it never affects visible-page extraction.
    }
  });
  return blocks;
}

function removeBoilerplate($: CheerioAPI): void {
  $(
    "nav, footer, aside, [role='navigation'], [role='banner'], [role='contentinfo'], [role='complementary']",
  ).remove();
  $("[class], [id]").each((_index, element) => {
    const names = `${$(element).attr("class") ?? ""} ${$(element).attr("id") ?? ""}`;
    if (COOKIE_UI_PATTERN.test(names)) {
      $(element).remove();
    }
  });
}

function extractLinks($: CheerioAPI, pageUrl: URL): readonly ExtractedLink[] {
  const links = new Map<string, ExtractedLink>();

  $("a[href]").each((_index, element) => {
    if (links.size >= MAX_EXTRACTED_LINKS) {
      return false;
    }

    const anchor = $(element);
    const href = anchor.attr("href");
    if (!href) {
      return;
    }

    let url: URL;
    try {
      url = parsePublicHttpUrl(new URL(href, pageUrl));
    } catch {
      return;
    }
    url.hash = "";

    const text = normalizeVisibleText(
      anchor.text() || anchor.attr("aria-label") || anchor.attr("title") || "",
    ).slice(0, 500);
    if (!text) {
      return;
    }

    const rel = (anchor.attr("rel") ?? "")
      .split(/\s+/u)
      .map((value) => value.toLowerCase())
      .filter(Boolean);
    const key = `${url.href}\n${text.toLowerCase()}`;
    links.set(key, {
      url: url.href,
      text,
      sameOrigin: haveSameOrigin(pageUrl, url),
      rel,
    });
  });

  return [...links.values()];
}

function contentScope($: CheerioAPI): Cheerio<AnyNode> {
  const main = $("main, [role='main']").first();
  if (main.length > 0) {
    return main;
  }
  const body = $("body").first();
  return body.length > 0 ? body : $.root();
}

function textWithoutNestedLists(
  $: CheerioAPI,
  element: AnyNode,
): string {
  const clone = $(element).clone();
  clone.find("ol, ul").remove();
  return normalizeVisibleText(clone.text());
}

function pushBlock(
  blocks: ExtractedTextBlock[],
  seenRepeatedProse: Set<string>,
  block: ExtractedTextBlock,
): void {
  if (!block.text) {
    return;
  }

  // Exact repeated prose is usually a duplicated banner or mobile/desktop
  // rendering. Short labels, lists, and tables can repeat legitimately.
  if ((block.kind === "paragraph" || block.kind === "quote") && block.text.length >= 32) {
    const fingerprint = block.text.toLowerCase();
    if (seenRepeatedProse.has(fingerprint)) {
      return;
    }
    seenRepeatedProse.add(fingerprint);
  }
  blocks.push(block);
}

function extractBlocks(
  $: CheerioAPI,
  scope: Cheerio<AnyNode>,
): readonly ExtractedTextBlock[] {
  const blocks: ExtractedTextBlock[] = [];
  const seenRepeatedProse = new Set<string>();
  const structuredSelector =
    "h1, h2, h3, h4, h5, h6, p, li, tr, dt, dd, blockquote, pre, legend, label, a[href]";
  const genericContainerSelector = "article, div, fieldset, form, main, section";
  const selector = `${structuredSelector}, ${genericContainerSelector}`;

  scope.find(selector).each((_index, element) => {
    const node = $(element);
    const tagName = element.type === "tag" ? element.name.toLowerCase() : "";

    if (genericContainerSelector.split(", ").includes(tagName)) {
      if (
        node.find(`${structuredSelector}, ${genericContainerSelector}`).length === 0
      ) {
        pushBlock(blocks, seenRepeatedProse, {
          kind: "paragraph",
          text: normalizeVisibleText(node.text()),
        });
      }
      return;
    }

    if (tagName === "a" && node.parents("p, li, tr, dt, dd, blockquote, pre, legend, label, h1, h2, h3, h4, h5, h6").length > 0) {
      return;
    }

    if (/^h[1-6]$/u.test(tagName)) {
      const headingLevel = Number(tagName.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
      pushBlock(blocks, seenRepeatedProse, {
        kind: "heading",
        text: normalizeVisibleText(node.text()),
        headingLevel,
      });
      return;
    }

    if (tagName === "li") {
      pushBlock(blocks, seenRepeatedProse, {
        kind: "list_item",
        text: textWithoutNestedLists($, element),
      });
      return;
    }

    if (tagName === "tr") {
      const cells = node
        .children("th, td")
        .toArray()
        .map((cell) => normalizeVisibleText($(cell).text()))
        .filter(Boolean);
      pushBlock(blocks, seenRepeatedProse, {
        kind: "table_row",
        text: cells.join(" | "),
        cells,
      });
      return;
    }

    if (tagName === "a") {
      const href = node.attr("href");
      if (!href) {
        return;
      }
      pushBlock(blocks, seenRepeatedProse, {
        kind: "link",
        text: normalizeVisibleText(
          node.text() || node.attr("aria-label") || node.attr("title") || "",
        ),
        href,
      });
      return;
    }

    const kind =
      tagName === "dt" || tagName === "dd"
        ? "definition"
        : tagName === "blockquote"
          ? "quote"
          : tagName === "pre"
            ? "preformatted"
            : "paragraph";
    pushBlock(blocks, seenRepeatedProse, {
      kind,
      text: normalizeVisibleText(node.text()),
    });
  });

  if (blocks.length === 0) {
    pushBlock(blocks, seenRepeatedProse, {
      kind: "paragraph",
      text: normalizeVisibleText(scope.text()),
    });
  }

  return blocks;
}

function capBlocks(
  blocks: readonly ExtractedTextBlock[],
  maximumCharacters: number,
): { blocks: readonly ExtractedTextBlock[]; text: string; truncated: boolean } {
  const kept: ExtractedTextBlock[] = [];
  let usedCharacters = 0;
  let truncated = false;

  for (const block of blocks) {
    const separatorLength = kept.length === 0 ? 0 : 1;
    const available = maximumCharacters - usedCharacters - separatorLength;
    if (available <= 0) {
      truncated = true;
      break;
    }

    if (block.text.length > available) {
      const shortened = block.text.slice(0, available).trimEnd();
      if (shortened) {
        kept.push(
          block.kind === "table_row"
            ? { kind: "table_row", text: shortened }
            : { ...block, text: shortened },
        );
        usedCharacters += separatorLength + shortened.length;
      }
      truncated = true;
      break;
    }

    kept.push(block);
    usedCharacters += separatorLength + block.text.length;
  }

  return {
    blocks: kept,
    text: kept.map((block) => block.text).join("\n"),
    truncated,
  };
}

function validateMaximumCharacters(value: number | undefined): number {
  const maximum = value ?? DEFAULT_MAX_EXTRACTED_CHARACTERS;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 1_000_000) {
    throw new RangeError("maxCharacters must be an integer from 1 through 1000000.");
  }
  return maximum;
}

export interface ExtractHtmlOptions {
  readonly maxCharacters?: number;
}

export function extractHtmlPage(
  html: string,
  pageUrl: string | URL,
  options: ExtractHtmlOptions = {},
): ExtractedSourcePage {
  if (html.length > MAX_SOURCE_INPUT_CHARACTERS) {
    throw new RangeError(
      `HTML source exceeds the ${MAX_SOURCE_INPUT_CHARACTERS}-character extraction limit.`,
    );
  }
  const url = parsePublicHttpUrl(pageUrl);
  const maximumCharacters = validateMaximumCharacters(options.maxCharacters);
  const $ = load(html, { scriptingEnabled: false });

  const structuredMetadataBlocks = extractStructuredMetadataBlocks($);
  removeHiddenAndExecutableContent($);
  const links = extractLinks($, url);
  removeBoilerplate($);
  const scope = contentScope($);
  const normalizedTitle = normalizeVisibleText($("title").first().text());
  const normalizedHeading = normalizeVisibleText($("h1").first().text());
  const title = (normalizedTitle || normalizedHeading || url.hostname).slice(
    0,
    MAX_SOURCE_TITLE_CHARACTERS,
  );
  const visibleBlocks = extractBlocks($, scope);
  const visibleText = new Set(visibleBlocks.map((block) => block.text.toLowerCase()));
  const capped = capBlocks([
    ...visibleBlocks,
    ...structuredMetadataBlocks.filter((block) => !visibleText.has(block.text.toLowerCase())),
  ], maximumCharacters);

  return {
    id: stablePageId(url.href),
    url: url.href,
    title,
    pageType: "user_supplied",
    trust: "untrusted_source_text",
    text: capped.text,
    blocks: capped.blocks,
    links,
    truncated: capped.truncated,
  };
}

export interface ExtractPlainTextOptions extends ExtractHtmlOptions {
  readonly title?: string;
}

export function extractPlainTextPage(
  sourceText: string,
  pageUrl: string | URL,
  options: ExtractPlainTextOptions = {},
): ExtractedSourcePage {
  if (sourceText.length > MAX_SOURCE_INPUT_CHARACTERS) {
    throw new RangeError(
      `Plain text exceeds the ${MAX_SOURCE_INPUT_CHARACTERS}-character extraction limit.`,
    );
  }
  const url = parsePublicHttpUrl(pageUrl);
  const maximumCharacters = validateMaximumCharacters(options.maxCharacters);
  const normalizedLines = sourceText
    .split(/\r?\n/u)
    .map(normalizeVisibleText)
    .filter(Boolean);
  const capped = capBlocks(
    normalizedLines.map((text) => ({ kind: "paragraph", text })),
    maximumCharacters,
  );
  const title = normalizeVisibleText(options.title ?? url.hostname).slice(
    0,
    MAX_SOURCE_TITLE_CHARACTERS,
  );

  return {
    id: stablePageId(url.href),
    url: url.href,
    title,
    pageType: "user_supplied",
    trust: "untrusted_source_text",
    text: capped.text,
    blocks: capped.blocks,
    links: [],
    truncated: capped.truncated,
  };
}

export function extractFetchedPage(
  fetchedPage: FetchedPage,
  options: ExtractPlainTextOptions = {},
): ExtractedSourcePage {
  return fetchedPage.contentType === "text/html"
    ? extractHtmlPage(fetchedPage.text, fetchedPage.url, options)
    : extractPlainTextPage(fetchedPage.text, fetchedPage.url, options);
}
