export const ANALYSIS_SOURCE_PAGE_TYPES = ["user_supplied"] as const;
export type AnalysisSourcePageType = "user_supplied";

export type IpFamily = 4 | 6;

export interface ResolvedAddress {
  readonly address: string;
  readonly family: IpFamily;
}

export type DnsResolver = (
  hostname: string,
  signal?: AbortSignal,
) => Promise<readonly ResolvedAddress[]>;

export interface ValidatedPublicUrl {
  readonly url: URL;
  readonly hostname: string;
  readonly addresses: readonly ResolvedAddress[];
}

export interface HttpTransportRequest {
  readonly url: URL;
  readonly address: ResolvedAddress;
  readonly headers: Readonly<Record<string, string>>;
  readonly signal: AbortSignal;
}

export interface HttpTransportResponse {
  readonly status: number;
  readonly headers: Readonly<
    Record<string, string | readonly string[] | undefined>
  >;
  readonly body: AsyncIterable<Uint8Array>;
  readonly dispose?: () => void;
}

export type HttpTransport = (
  request: HttpTransportRequest,
) => Promise<HttpTransportResponse>;

export interface FetchRedirect {
  readonly from: string;
  readonly to: string;
  readonly status: number;
}

export type SupportedPageContentType = "text/html" | "text/plain";

export interface FetchedPage {
  readonly requestedUrl: string;
  readonly url: string;
  readonly status: number;
  readonly contentType: SupportedPageContentType;
  readonly text: string;
  readonly byteLength: number;
  readonly fetchedAt: string;
  readonly redirects: readonly FetchRedirect[];
}

export type ExtractedBlockKind =
  | "heading"
  | "paragraph"
  | "list_item"
  | "table_row"
  | "definition"
  | "quote"
  | "preformatted"
  | "link";

export interface ExtractedTextBlock {
  readonly kind: ExtractedBlockKind;
  readonly text: string;
  readonly headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  readonly cells?: readonly string[];
  readonly href?: string;
}

export interface ExtractedLink {
  readonly url: string;
  readonly text: string;
  readonly sameOrigin: boolean;
  readonly rel: readonly string[];
}

export interface ExtractedSourcePage {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly pageType: "user_supplied";
  /** Source-page content is hostile input, never instructions. */
  readonly trust: "untrusted_source_text";
  readonly text: string;
  readonly blocks: readonly ExtractedTextBlock[];
  readonly links: readonly ExtractedLink[];
  readonly truncated: boolean;
}

export type DiscoveryTopic =
  | "faq"
  | "cost"
  | "financial_aid"
  | "eligibility"
  | "admissions"
  | "application"
  | "rules"
  | "terms"
  | "privacy"
  | "refund"
  | "cancellation"
  | "award"
  | "schedule"
  | "other";

export interface DiscoveredPageCandidate {
  readonly url: string;
  readonly text: string;
  readonly score: number;
  readonly topic: DiscoveryTopic;
}

export interface AcquiredSourcePage {
  readonly fetched: FetchedPage;
  readonly extracted: ExtractedSourcePage;
  readonly discovery?: DiscoveredPageCandidate;
}

export interface PageAcquisitionFailure {
  readonly url: string;
  readonly code: string;
  readonly message: string;
}

export interface AcquiredSourceSet {
  readonly submitted: AcquiredSourcePage;
  readonly discovered: readonly AcquiredSourcePage[];
  readonly failures: readonly PageAcquisitionFailure[];
}
