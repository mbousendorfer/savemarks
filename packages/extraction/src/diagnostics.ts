import {
  diagnosticEventSchema,
  type DiagnosticEvent,
} from "@savemarks/shared/messages";
import type { Source } from "@savemarks/shared/models";
import { redactSecrets } from "@savemarks/shared/redaction";
import type {
  CapturedNetworkEvent,
  SanitizedFixture,
} from "./types";

const ALLOWED_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "www.instagram.com",
]);
const SENSITIVE_QUERY_KEYS =
  /^(token|auth|authorization|csrf|session|cookie|sig|signature|key)$/i;
const CURSOR_NAME = /(cursor|next[_-]?max[_-]?id|page[_-]?info|end[_-]?cursor)/i;
const SAVE_NAME = /(^|[_./-])(bookmark|save|saved)([_./-]|$)/i;
const UNSAVE_NAME = /(^|[_./-])(unbookmark|unsave|remove)([_./-]|$)/i;

export function sourceForUrl(value: string): Source | null {
  try {
    const hostname = new URL(value).hostname;
    if (hostname === "x.com" || hostname === "twitter.com") return "x";
    if (hostname === "www.instagram.com") return "instagram";
    return null;
  } catch {
    return null;
  }
}

export function sanitizeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!ALLOWED_HOSTS.has(url.hostname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function fieldPaths(
  value: unknown,
  maxDepth = 8,
  maxPaths = 2_000,
): string[] {
  const result = new Set<string>();
  const visit = (node: unknown, prefix: string, depth: number): void => {
    if (depth > maxDepth || result.size >= maxPaths || node === null) return;
    if (Array.isArray(node)) {
      if (node.length > 0) visit(node[0], `${prefix}[]`, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      result.add(path);
      visit(child, path, depth + 1);
    }
  };
  visit(value, "", 0);
  return [...result].sort();
}

export function cursorPaths(value: unknown): string[] {
  return fieldPaths(value).filter((path) => CURSOR_NAME.test(path));
}

export function inferMutation(
  url: string,
  operationName?: string,
): "save" | "unsave" | undefined {
  const signal = `${new URL(url).pathname}/${operationName ?? ""}`;
  if (UNSAVE_NAME.test(signal)) return "unsave";
  if (SAVE_NAME.test(signal)) return "save";
  return undefined;
}

export function toDiagnosticEvent(
  event: CapturedNetworkEvent,
  id = crypto.randomUUID(),
): DiagnosticEvent | null {
  const sanitizedUrl = sanitizeUrl(event.request.url);
  if (!sanitizedUrl) return null;
  const source = sourceForUrl(sanitizedUrl);
  if (!source) return null;
  const method = event.request.method.toUpperCase();
  const candidate = {
    id,
    source,
    occurredAt: event.request.capturedAt,
    transport: "fetch" as const,
    method,
    sanitizedUrl,
    operationName: event.request.operationName,
    requestShape: fieldPaths(event.request.body),
    responseShape: fieldPaths(event.response),
    status: event.status,
    cursorPaths: cursorPaths(event.response),
    mutation: inferMutation(sanitizedUrl, event.request.operationName),
  };
  const parsed = diagnosticEventSchema.safeParse(redactSecrets(candidate));
  return parsed.success ? parsed.data : null;
}

export function exportFixture(
  events: DiagnosticEvent[],
  sourceSchemaDate: string,
  exportedAt = new Date().toISOString(),
): SanitizedFixture {
  return {
    schemaVersion: 1,
    sourceSchemaDate,
    exportedAt,
    events: events.map((event) => diagnosticEventSchema.parse(event)),
  };
}
