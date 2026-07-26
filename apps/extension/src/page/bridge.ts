import {
  cursorPaths,
  fieldPaths,
  inferMutation,
  parseXBookmarksPage,
  sanitizeUrl,
  sourceForUrl,
} from "@savemarks/extraction";
import { redactSecrets } from "@savemarks/shared/redaction";

let diagnosticsEnabled = false;
const nativeFetch = window.fetch.bind(window);
const NativeXhr = window.XMLHttpRequest;
let bookmarkPageFetcher: ((cursor: string) => Promise<Response>) | undefined;
let latestBookmarkCursor: string | undefined;
let pendingImportCursor: string | undefined;
let pendingImportStart = false;
let importRunning = false;
let importCancelled = false;

function post(message: unknown): void {
  window.postMessage(
    { channel: "SAVEMARKS_PAGE", message },
    window.location.origin,
  );
}

function operationName(body: unknown, urlValue: string): string | undefined {
  if (typeof body === "string") {
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
      // Fall through to the observed GraphQL URL.
    }
  }

  try {
    const parts = new URL(urlValue, window.location.origin).pathname.split("/");
    const graphqlIndex = parts.indexOf("graphql");
    const observed = graphqlIndex >= 0 ? parts[graphqlIndex + 2] : undefined;
    return observed ? decodeURIComponent(observed).slice(0, 256) : undefined;
  } catch {
    return undefined;
  }
}

function relevant(paths: string[], url: string, operation?: string): boolean {
  const signal = `${url} ${operation ?? ""} ${paths.join(" ")}`;
  return /(bookmark|saved|save|cursor|page_info|next_max_id)/i.test(signal);
}

function importProgress(
  status: "running" | "paused" | "complete" | "error" | "waiting",
  imported: number,
  pages: number,
  cursor?: string,
  error?: string,
): void {
  post({
    type: "SAVEMARKS_X_IMPORT_PROGRESS",
    version: 1,
    payload: {
      status,
      imported,
      pages,
      ...(cursor ? { cursor } : {}),
      ...(error ? { error } : {}),
      updatedAt: new Date().toISOString(),
    },
  });
}

function urlWithCursor(value: string, cursor: string): URL {
  const url = new URL(value);
  const variables = JSON.parse(url.searchParams.get("variables") ?? "{}") as Record<
    string,
    unknown
  >;
  variables.cursor = cursor;
  variables.count = 40;
  url.searchParams.set("variables", JSON.stringify(variables));
  return url;
}

async function startHistoricalImport(startCursor?: string): Promise<void> {
  if (importRunning) return;
  const firstCursor = startCursor ?? latestBookmarkCursor;
  if (!bookmarkPageFetcher || !firstCursor) {
    pendingImportStart = true;
    pendingImportCursor = startCursor;
    importProgress("waiting", 0, 0, startCursor);
    return;
  }

  importRunning = true;
  importCancelled = false;
  let cursor: string | undefined = firstCursor;
  let imported = 0;
  let pages = 0;

  try {
    while (cursor && pages < 500 && !importCancelled) {
      await new Promise((resolve) => window.setTimeout(resolve, 1_500));
      const response = await bookmarkPageFetcher(cursor);
      if ([401, 403, 429].includes(response.status)) {
        throw new Error(`X stopped the import with HTTP ${response.status}`);
      }
      if (!response.ok) throw new Error(`X returned HTTP ${response.status}`);
      const json = (await response.json()) as unknown;
      const page = parseXBookmarksPage(json);
      for (const bookmark of page.items) {
        post({
          type: "SAVEMARKS_DETECTED_BOOKMARK",
          version: 1,
          payload: bookmark,
        });
      }
      imported += page.items.length;
      pages += 1;
      const nextCursor = page.cursor;
      if (!nextCursor || nextCursor === cursor || page.items.length === 0) {
        cursor = nextCursor;
        break;
      }
      cursor = nextCursor;
      importProgress("running", imported, pages, cursor);
    }

    importProgress(
      importCancelled ? "paused" : "complete",
      imported,
      pages,
      cursor,
    );
  } catch (error) {
    importProgress(
      "error",
      imported,
      pages,
      cursor,
      error instanceof Error ? error.message : "Historical import failed",
    );
  } finally {
    importRunning = false;
  }
}

async function inspect(
  transport: "fetch" | "xhr",
  urlValue: string,
  method: string,
  body: unknown,
  status: number,
  response: unknown,
): Promise<void> {
  const url = sanitizeUrl(urlValue);
  const source = url ? sourceForUrl(url) : null;
  if (!url || !source) return;
  const operation = operationName(body, urlValue);

  if (source === "x" && operation === "Bookmarks" && status === 200) {
    const page = parseXBookmarksPage(response);
    latestBookmarkCursor = page.cursor;
    for (const bookmark of page.items) {
      post({
        type: "SAVEMARKS_DETECTED_BOOKMARK",
        version: 1,
        payload: bookmark,
      });
    }
    if (pendingImportStart) {
      const requestedCursor = pendingImportCursor;
      pendingImportStart = false;
      pendingImportCursor = undefined;
      void startHistoricalImport(requestedCursor);
    }
  }

  if (!diagnosticsEnabled) return;
  const responseShape = fieldPaths(response);
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
  } else if (
    typeof event.data === "object" &&
    event.data !== null &&
    "channel" in event.data &&
    event.data.channel === "SAVEMARKS_CONTROL" &&
    "type" in event.data &&
    event.data.type === "START_X_IMPORT"
  ) {
    const cursor =
      "cursor" in event.data && typeof event.data.cursor === "string"
        ? event.data.cursor
        : undefined;
    void startHistoricalImport(cursor);
  } else if (
    typeof event.data === "object" &&
    event.data !== null &&
    "channel" in event.data &&
    event.data.channel === "SAVEMARKS_CONTROL" &&
    "type" in event.data &&
    event.data.type === "CANCEL_X_IMPORT"
  ) {
    importCancelled = true;
  }
});

post({
  type: "SAVEMARKS_BRIDGE_READY",
  version: 1,
});

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await nativeFetch(input, init);
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const operation = operationName(init?.body, url);
  if (operation === "Bookmarks") {
    try {
      const template =
        input instanceof Request
          ? new Request(input, init)
          : new Request(new URL(url, window.location.origin), init);
      bookmarkPageFetcher = (cursor) =>
        nativeFetch(new Request(urlWithCursor(template.url, cursor), template));
    } catch {
      bookmarkPageFetcher = undefined;
    }
  }
  if (diagnosticsEnabled || operation === "Bookmarks") {
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
  private requestHeaders = new Headers();

  override open(method: string, url: string | URL, ...rest: unknown[]): void {
    this.requestMethod = method;
    this.requestUrl = url.toString();
    this.requestHeaders = new Headers();
    Reflect.apply(NativeXhr.prototype.open, this, [method, url, ...rest]);
  }

  override setRequestHeader(name: string, value: string): void {
    this.requestHeaders.append(name, value);
    super.setRequestHeader(name, value);
  }

  override send(body?: Document | XMLHttpRequestBodyInit | null): void {
    this.requestBody = body;
    const operation = operationName(body, this.requestUrl);
    if (operation === "Bookmarks") {
      const url = new URL(this.requestUrl, window.location.origin).toString();
      const method = this.requestMethod;
      const headers = new Headers(this.requestHeaders);
      const credentials: RequestCredentials = this.withCredentials
        ? "include"
        : "same-origin";
      bookmarkPageFetcher = (cursor) =>
        nativeFetch(urlWithCursor(url, cursor), {
          method,
          headers,
          credentials,
          ...(method.toUpperCase() === "GET" || body == null
            ? {}
            : { body: body as BodyInit }),
        });
    }
    this.addEventListener("load", () => {
    try {
      const json = JSON.parse(this.responseText) as unknown;
      const operation = operationName(this.requestBody, this.requestUrl);
      if (!diagnosticsEnabled && operation !== "Bookmarks") return;
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
