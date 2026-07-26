import {
  cursorPaths,
  fieldPaths,
  inferMutation,
  sanitizeUrl,
  sourceForUrl,
} from "@savemarks/extraction";
import { redactSecrets } from "@savemarks/shared/redaction";

let diagnosticsEnabled = false;
const nativeFetch = window.fetch.bind(window);
const NativeXhr = window.XMLHttpRequest;

function post(message: unknown): void {
  window.postMessage(
    { channel: "SAVEMARKS_PAGE", message },
    window.location.origin,
  );
}

function operationName(body: unknown): string | undefined {
  if (typeof body !== "string") return undefined;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "operationName" in parsed &&
      typeof parsed.operationName === "string"
    ) {
      return parsed.operationName.slice(0, 256);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function relevant(paths: string[], url: string, operation?: string): boolean {
  const signal = `${url} ${operation ?? ""} ${paths.join(" ")}`;
  return /(bookmark|saved|save|cursor|page_info|next_max_id)/i.test(signal);
}

async function inspect(
  transport: "fetch" | "xhr",
  urlValue: string,
  method: string,
  body: unknown,
  status: number,
  response: unknown,
): Promise<void> {
  if (!diagnosticsEnabled) return;
  const url = sanitizeUrl(urlValue);
  const source = url ? sourceForUrl(url) : null;
  if (!url || !source) return;
  const responseShape = fieldPaths(response);
  const operation = operationName(body);
  if (!relevant(responseShape, url, operation)) return;

  post({
    type: "SAVEMARKS_DIAGNOSTIC_EVENT",
    version: 1,
    payload: {
      id: crypto.randomUUID(),
      source,
      occurredAt: new Date().toISOString(),
      transport,
      method: method.toUpperCase(),
      sanitizedUrl: url,
      operationName: operation,
      requestShape: fieldPaths(body),
      responseShape,
      status,
      cursorPaths: cursorPaths(response),
      mutation: inferMutation(url, operation),
    },
  });

  const upperMethod = method.toUpperCase();
  if (
    (upperMethod === "GET" || upperMethod === "POST") &&
    cursorPaths(response).length > 0
  ) {
    post({
      type: "SAVEMARKS_TEMPLATE_CAPTURED",
      version: 1,
      payload: {
        source,
        url,
        method: upperMethod,
        operationName: operation,
        body: redactSecrets(body),
        capturedAt: new Date().toISOString(),
        schemaVersion: 1,
      },
    });
  }
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  if (
    typeof event.data === "object" &&
    event.data !== null &&
    "channel" in event.data &&
    event.data.channel === "SAVEMARKS_CONTROL" &&
    "type" in event.data &&
    event.data.type === "SET_DIAGNOSTICS" &&
    "enabled" in event.data
  ) {
    diagnosticsEnabled = event.data.enabled === true;
  }
});

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await nativeFetch(input, init);
  if (diagnosticsEnabled) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const body = init?.body;
    void response
      .clone()
      .json()
      .then((json: unknown) =>
        inspect("fetch", url, method, body, response.status, json),
      )
      .catch(() => undefined);
  }
  return response;
};

class SaveMarksXhr extends NativeXhr {
  private requestUrl = "";
  private requestMethod = "GET";
  private requestBody: unknown;

  override open(method: string, url: string | URL, ...rest: unknown[]): void {
    this.requestMethod = method;
    this.requestUrl = url.toString();
    Reflect.apply(NativeXhr.prototype.open, this, [method, url, ...rest]);
  }

  override send(body?: Document | XMLHttpRequestBodyInit | null): void {
    this.requestBody = body;
    this.addEventListener("load", () => {
      if (!diagnosticsEnabled) return;
      try {
        const json = JSON.parse(this.responseText) as unknown;
        void inspect(
          "xhr",
          this.requestUrl,
          this.requestMethod,
          this.requestBody,
          this.status,
          json,
        );
      } catch {
        // Non-JSON responses are intentionally ignored.
      }
    });
    super.send(body);
  }
}

window.XMLHttpRequest = SaveMarksXhr;
