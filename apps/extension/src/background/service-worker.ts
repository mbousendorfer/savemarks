import { diagnosticEventSchema } from "@savemarks/shared/messages";
import { normalizedBookmarkSchema } from "@savemarks/shared/models";
import { enqueue, flushQueue, queueStats } from "../lib/queue";
import { getSettings, setSettings } from "../lib/settings";

const SYNC_ALARM = "savemarks-sync";
const MAX_DIAGNOSTIC_EVENTS = 250;

async function configureAlarm(): Promise<void> {
  const settings = await getSettings();
  await chrome.alarms.clear(SYNC_ALARM);
  if (settings.syncEnabled) {
    await chrome.alarms.create(SYNC_ALARM, {
      periodInMinutes: settings.syncIntervalMinutes,
    });
  }
}

async function synchronize(): Promise<void> {
  const settings = await getSettings();
  if (!settings.syncEnabled || !settings.serverUrl || !settings.apiToken) return;
  await flushQueue(settings.serverUrl, settings.apiToken);
  await setSettings({ lastSuccessfulSync: new Date().toISOString() });
}

chrome.runtime.onInstalled.addListener(() => {
  void configureAlarm();
});
chrome.runtime.onStartup.addListener(() => {
  void configureAlarm();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) void synchronize();
});
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") void configureAlarm();
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  void (async () => {
    if (typeof message !== "object" || message === null || !("type" in message)) {
      sendResponse({ ok: false });
      return;
    }
    const type = (message as { type: unknown }).type;
    if (type === "ENQUEUE_BOOKMARK") {
      const parsed = normalizedBookmarkSchema.safeParse(
        (message as { payload?: unknown }).payload,
      );
      if (parsed.success) {
        await enqueue(parsed.data);
        void synchronize();
      }
      sendResponse({ ok: parsed.success });
      return;
    }
    if (type === "STORE_DIAGNOSTIC") {
      const parsed = diagnosticEventSchema.safeParse(
        (message as { payload?: unknown }).payload,
      );
      if (parsed.success) {
        const stored = await chrome.storage.local.get("diagnosticEvents");
        const events = Array.isArray(stored.diagnosticEvents)
          ? stored.diagnosticEvents
          : [];
        await chrome.storage.local.set({
          diagnosticEvents: [...events, parsed.data].slice(-MAX_DIAGNOSTIC_EVENTS),
        });
      }
      sendResponse({ ok: parsed.success });
      return;
    }
    if (type === "STORE_TEMPLATE") {
      const payload = (message as { payload?: unknown }).payload;
      const stored = await chrome.storage.local.get("capturedTemplates");
      const templates = Array.isArray(stored.capturedTemplates)
        ? stored.capturedTemplates
        : [];
      await chrome.storage.local.set({
        capturedTemplates: [...templates, payload].slice(-10),
      });
      sendResponse({ ok: true });
      return;
    }
    if (type === "QUEUE_STATS") {
      sendResponse(await queueStats());
      return;
    }
    if (type === "SYNC_NOW") {
      await synchronize();
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: false });
  })();
  return true;
});
