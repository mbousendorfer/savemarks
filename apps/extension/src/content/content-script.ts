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

void refreshDiagnosticsState();

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
