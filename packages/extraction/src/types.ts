import type {
  DiagnosticEvent,
  NormalizedBookmark,
  Source,
  SourceErrorCode,
} from "@savemarks/shared";

export interface CapturedRequest {
  source: Source;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  operationName?: string;
  capturedAt: string;
}

export interface SanitizedRequestTemplate {
  source: Source;
  url: string;
  method: "GET" | "POST";
  operationName?: string;
  body?: unknown;
  capturedAt: string;
  schemaVersion: 1;
}

export interface CapturedNetworkEvent {
  request: CapturedRequest;
  response: unknown;
  status: number;
}

export interface DomEvent {
  source: Source;
  kind: "save-click";
  canonicalUrl?: string;
  visibleData?: unknown;
}

export interface DetectedSave {
  action: "save" | "unsave";
  bookmark?: NormalizedBookmark;
}

export interface PaginatedSourceResult {
  items: NormalizedBookmark[];
  cursor?: string;
  exhausted: boolean;
}

export interface TemplateValidationResult {
  valid: boolean;
  reason?: string;
}

export interface AdapterError {
  code: SourceErrorCode;
  message: string;
  recoverable: boolean;
}

export type CredentialedPageExecutor = (
  template: SanitizedRequestTemplate,
  cursor?: string,
) => Promise<{ status: number; body: unknown }>;

export interface SourceAdapter {
  source: Source;
  detectSaveEvent(
    event: CapturedNetworkEvent | DomEvent,
  ): Promise<DetectedSave | null>;
  parseItem(raw: unknown): Promise<NormalizedBookmark | null>;
  captureSyncTemplate(
    request: CapturedRequest,
  ): Promise<SanitizedRequestTemplate | null>;
  fetchIncrementalPage(
    template: SanitizedRequestTemplate,
    cursor?: string,
  ): Promise<PaginatedSourceResult>;
  validateTemplate(
    template: SanitizedRequestTemplate,
  ): Promise<TemplateValidationResult>;
}

export interface SanitizedFixture {
  schemaVersion: 1;
  sourceSchemaDate: string;
  exportedAt: string;
  events: DiagnosticEvent[];
}
