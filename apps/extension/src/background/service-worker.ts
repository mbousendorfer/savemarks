import { diagnosticEventSchema } from "@savemarks/shared/messages";
import {
  normalizedBookmarkSchema,
  readLaterCaptureSchema,
} from "@savemarks/shared/models";
import { enqueue, enqueueReadLater, flushQueue, queueStats } from "../lib/queue";
import { previewActiveTab, previewToCapture } from "../lib/read-later";
import { getSettings, setSettings } from "../lib/settings";

const SYNC_ALARM = "savemarks-sync";
const MAX_DIAGNOSTIC_EVENTS = 250;
let activeSynchronization: Promise<void> | undefined;

async function configureContextMenus(): Promise<void> {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: "savemarks-read-page",
    title: "Save page to Read later",
    contexts: ["page"],
    documentUrlPatterns: ["http://*/*", "https://*/*"],
  });
  chrome.contextMenus.create({
    id: "savemarks-read-link",
    title: "Save link to Read later",
    contexts: ["link"],
    targetUrlPatterns: ["http://*/*", "https://*/*"],
  });
}

async function showCaptureFeedback(ok: boolean) {
  await chrome.action.setBadgeBackgroundColor({ color: ok ? "#6f9f2f" : "#b7483d" });
  await chrome.action.setBadgeText({ text: ok ? "✓" : "!" });
  setTimeout(() => void chrome.action.setBadgeText({ text: "" }), 2_000);
}

async function configureAlarm(): Promise<void> {
  const settings = await getSettings();
  await chrome.alarms.clear(SYNC_ALARM);
  if (settings.syncEnabled) {
    await chrome.alarms.create(SYNC_ALARM, {
      periodInMinutes: settings.syncIntervalMinutes,
    });
  }
}

async function synchronize(): Promise<number> {
  const settings = await getSettings();
  if (!settings.syncEnabled || !settings.serverUrl || !settings.apiToken) return 0;
  const processed = await flushQueue(settings.serverUrl, settings.apiToken);
  await setSettings({ lastSuccessfulSync: new Date().toISOString() });
  return processed;
}

function scheduleSynchronization(): void {
  if (activeSynchronization) return;
  activeSynchronization = (async () => {
    let processed: number;
    do {
      processed = await synchronize();
    } while (processed === 25);
  })().finally(() => {
    activeSynchronization = undefined;
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void configureAlarm();
  void configureContextMenus();
});
chrome.runtime.onStartup.addListener(() => {
  void configureAlarm();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) scheduleSynchronization();
});
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") void configureAlarm();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void (async () => {
    let capture;
    if (info.menuItemId === "savemarks-read-link" && info.linkUrl) {
      const parsed = readLaterCaptureSchema.safeParse({ url: info.linkUrl, tags: [] });
      capture = parsed.success ? parsed.data : undefined;
    } else if (info.menuItemId === "savemarks-read-page") {
      capture = previewToCapture(await previewActiveTab(tab?.id), []);
    }
    if (!capture) {
      await showCaptureFeedback(false);
      return;
    }
    await enqueueReadLater(capture);
    scheduleSynchronization();
    await showCaptureFeedback(true);
  })();
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
        await chrome.storage.local.set({
          xAdapterActive: parsed.data.source === "x" || undefined,
          instagramAdapterActive:
            parsed.data.source === "instagram" || undefined,
        });
        scheduleSynchronization();
      }
      sendResponse({ ok: parsed.success });
      return;
    }
    if (type === "PREVIEW_ACTIVE_TAB") {
      const tabId = (message as { tabId?: unknown }).tabId;
      sendResponse(
        await previewActiveTab(typeof tabId === "number" ? tabId : undefined),
      );
      return;
    }
    if (type === "ENQUEUE_READ_LATER") {
      const parsed = readLaterCaptureSchema.safeParse(
        (message as { payload?: unknown }).payload,
      );
      if (parsed.success) {
        await enqueueReadLater(parsed.data);
        scheduleSynchronization();
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
      scheduleSynchronization();
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: false });
  })();
  return true;
});
