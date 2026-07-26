import type {
  NormalizedBookmark,
  Source,
} from "@savemarks/shared";
import { extractCursor } from "../cursors";
import { captureTemplate, validateCapturedTemplate } from "../template";
import type {
  CapturedNetworkEvent,
  CapturedRequest,
  CredentialedPageExecutor,
  DetectedSave,
  DomEvent,
  PaginatedSourceResult,
  SanitizedRequestTemplate,
  SourceAdapter,
  TemplateValidationResult,
} from "../types";

export abstract class ObservedSourceAdapter implements SourceAdapter {
  abstract readonly source: Source;

  constructor(protected readonly executeInPage: CredentialedPageExecutor) {}

  async detectSaveEvent(
    _event: CapturedNetworkEvent | DomEvent,
  ): Promise<DetectedSave | null> {
    return null;
  }

  async parseItem(_raw: unknown): Promise<NormalizedBookmark | null> {
    return null;
  }

  async captureSyncTemplate(
    request: CapturedRequest,
  ): Promise<SanitizedRequestTemplate | null> {
    return captureTemplate(this.source, request);
  }

  async fetchIncrementalPage(
    template: SanitizedRequestTemplate,
    cursor?: string,
  ): Promise<PaginatedSourceResult> {
    const validation = await this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(validation.reason ?? "Invalid captured request template");
    }
    const response = await this.executeInPage(template, cursor);
    if ([401, 403, 429].includes(response.status)) {
      throw new Error(`Source synchronization stopped with ${response.status}`);
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Unexpected source response ${response.status}`);
    }
    const items = await this.parseObservedPage(response.body);
    const nextCursor = extractCursor(response.body);
    return {
      items,
      ...(nextCursor ? { cursor: nextCursor } : {}),
      exhausted: nextCursor === undefined,
    };
  }

  async validateTemplate(
    template: SanitizedRequestTemplate,
  ): Promise<TemplateValidationResult> {
    return validateCapturedTemplate(this.source, template);
  }

  protected abstract parseObservedPage(
    raw: unknown,
  ): Promise<NormalizedBookmark[]>;
}
