import { pageBridgeMessageSchema } from "@savemarks/shared/messages";
import { getSettings } from "../lib/settings";

function sendDiagnosticsState(enabled: boolean): void {
  window.postMessage(
    {
      channel: "SAVEMARKS_CONTROL",
      type: "SET_DIAGNOSTICS",
      enabled,
    },
    window.location.origin,
  );
}

async function refreshDiagnosticsState(): Promise<void> {
  const settings = await getSettings();
  sendDiagnosticsState(settings.diagnosticsEnabled);
}

async function resumeHistoricalImport(): Promise<void> {
  if (window.location.pathname !== "/i/bookmarks") return;
  const stored = await chrome.storage.local.get("xImportState");
  const state = stored.xImportState as
    | { status?: string; cursor?: string }
    | undefined;
  if (state?.status === "running" || state?.status === "waiting") {
    window.postMessage(
      {
        channel: "SAVEMARKS_CONTROL",
        type: "START_X_IMPORT",
        cursor: state.cursor,
      },
      window.location.origin,
    );
  }
}

void refreshDiagnosticsState();

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (typeof message !== "object" || message === null || !("type" in message)) {
    return;
  }
  if (message.type === "START_X_IMPORT") {
    const cursor =
      "cursor" in message && typeof message.cursor === "string"
        ? message.cursor
        : undefined;
    window.postMessage(
      { channel: "SAVEMARKS_CONTROL", type: "START_X_IMPORT", cursor },
      window.location.origin,
    );
    sendResponse({ ok: true });
  } else if (message.type === "CANCEL_X_IMPORT") {
    window.postMessage(
      { channel: "SAVEMARKS_CONTROL", type: "CANCEL_X_IMPORT" },
      window.location.origin,
    );
    sendResponse({ ok: true });
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.diagnosticsEnabled) {
    sendDiagnosticsState(changes.diagnosticsEnabled.newValue === true);
  }
});

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  if (
    typeof event.data !== "object" ||
    event.data === null ||
    !("channel" in event.data) ||
    event.data.channel !== "SAVEMARKS_PAGE"
  ) {
    return;
  }

  const message = (event.data as { message?: unknown }).message;
  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "SAVEMARKS_BRIDGE_READY"
  ) {
    void refreshDiagnosticsState();
    void resumeHistoricalImport();
    return;
  }

  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "SAVEMARKS_X_IMPORT_PROGRESS" &&
    "payload" in message
  ) {
    void chrome.storage.local.set({ xImportState: message.payload });
    return;
  }

  const parsed = pageBridgeMessageSchema.safeParse(
    message,
  );
  if (!parsed.success) return;

  if (parsed.data.type === "SAVEMARKS_DIAGNOSTIC_EVENT") {
    void chrome.runtime.sendMessage({
      type: "STORE_DIAGNOSTIC",
      payload: parsed.data.payload,
    });
  } else if (parsed.data.type === "SAVEMARKS_TEMPLATE_CAPTURED") {
    void chrome.runtime.sendMessage({
      type: "STORE_TEMPLATE",
      payload: parsed.data.payload,
    });
  } else {
    void chrome.runtime.sendMessage({
      type: "ENQUEUE_BOOKMARK",
      payload: parsed.data.payload,
    });
  }
});
