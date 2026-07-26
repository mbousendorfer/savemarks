import type { NormalizedBookmark } from "@savemarks/shared";
import { ObservedSourceAdapter } from "./base";

export class XAdapter extends ObservedSourceAdapter {
  readonly source = "x" as const;

  protected async parseObservedPage(
    _raw: unknown,
  ): Promise<NormalizedBookmark[]> {
    // Added only after a sanitized live capture establishes the response schema.
    return [];
  }
}
