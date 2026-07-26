import type { Source } from "@savemarks/shared/models";
import { redactSecrets } from "@savemarks/shared/redaction";
import { sanitizeUrl, sourceForUrl } from "./diagnostics";
import type {
  CapturedRequest,
  SanitizedRequestTemplate,
  TemplateValidationResult,
} from "./types";

export function captureTemplate(
  expectedSource: Source,
  request: CapturedRequest,
): SanitizedRequestTemplate | null {
  const method = request.method.toUpperCase();
  const url = sanitizeUrl(request.url);
  if (!url || sourceForUrl(url) !== expectedSource) return null;
  if (method !== "GET" && method !== "POST") return null;

  const template: SanitizedRequestTemplate = {
    source: expectedSource,
    url,
    method: method as "GET" | "POST",
    ...(request.operationName
      ? { operationName: request.operationName }
      : {}),
    ...(request.body === undefined
      ? {}
      : { body: redactSecrets(request.body) }),
    capturedAt: request.capturedAt,
    schemaVersion: 1 as const,
  };
  return template;
}

export function validateCapturedTemplate(
  expectedSource: Source,
  template: SanitizedRequestTemplate,
): TemplateValidationResult {
  if (template.source !== expectedSource) {
    return { valid: false, reason: "Template source does not match adapter." };
  }
  if (sourceForUrl(template.url) !== expectedSource) {
    return { valid: false, reason: "Template URL is outside the source host." };
  }
  if (JSON.stringify(template).match(/bearer\s|cookie|csrf|sessionid/i)) {
    return { valid: false, reason: "Template contains authentication material." };
  }
  return { valid: true };
}
