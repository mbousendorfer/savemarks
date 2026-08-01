import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { PagePreview } from "../lib/read-later";
import { getSettings } from "../lib/settings";
import "../ui.css";

interface Status {
  paired: boolean;
  server: "not configured" | "checking" | "online" | "offline";
  pending: number;
  failed: number;
  lastSuccessfulSync?: string;
}

function tagsFromInput(value: string) {
  return [...new Set(value.split(/[,;]/).map((tag) => tag.trim()).filter(Boolean))];
}

function Popup() {
  const [status, setStatus] = useState<Status>({
    paired: false,
    server: "not configured",
    pending: 0,
    failed: 0,
  });
  const [preview, setPreview] = useState<PagePreview>({ supported: false });
  const [tags, setTags] = useState("");
  const [feedback, setFeedback] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function refresh(): Promise<void> {
    const settings = await getSettings();
    const stats = (await chrome.runtime.sendMessage({ type: "QUEUE_STATS" })) as {
      pending: number;
      failed: number;
    };
    setStatus({
      paired: Boolean(settings.apiToken),
      server: settings.serverUrl ? "checking" : "not configured",
      pending: stats.pending,
      failed: stats.failed,
      ...(settings.lastSuccessfulSync
        ? { lastSuccessfulSync: settings.lastSuccessfulSync }
        : {}),
    });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const page = (await chrome.runtime.sendMessage({
      type: "PREVIEW_ACTIVE_TAB",
      tabId: tab?.id,
    })) as PagePreview;
    setPreview(page);
    if (settings.serverUrl) {
      try {
        const response = await fetch(`${settings.serverUrl.replace(/\/$/, "")}/api/health`);
        setStatus((current) => ({ ...current, server: response.ok ? "online" : "offline" }));
      } catch {
        setStatus((current) => ({ ...current, server: "offline" }));
      }
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function savePage() {
    if (!preview.supported || !preview.url) return;
    setFeedback("saving");
    const response = (await chrome.runtime.sendMessage({
      type: "ENQUEUE_READ_LATER",
      payload: {
        url: preview.url,
        metadata: {
          title: preview.title,
          description: preview.description,
          siteName: preview.siteName,
          author: preview.author,
          imageUrl: preview.imageUrl,
        },
        tags: tagsFromInput(tags),
      },
    })) as { ok: boolean };
    setFeedback(response.ok ? "saved" : "error");
    if (response.ok) {
      setTags("");
      await refresh();
    }
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <strong>SaveMarks</strong>
          <span>read later</span>
        </div>
        <i className={`server-dot ${status.server}`} title={status.server} />
      </header>

      <section className="capture-panel">
        <p className="eyebrow">Current page</p>
        {preview.supported ? (
          <>
            <h1>{preview.title || preview.siteName || "Untitled page"}</h1>
            <p className="capture-host">{preview.siteName}</p>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Tags, separated by commas"
              aria-label="Tags"
            />
            <button
              className="capture-button"
              disabled={!status.paired || feedback === "saving"}
              onClick={() => void savePage()}
            >
              {feedback === "saving"
                ? "Saving…"
                : feedback === "saved"
                  ? "Saved to Read later"
                  : "Read later"}
            </button>
          </>
        ) : (
          <p className="unsupported">This browser page cannot be saved.</p>
        )}
        {!status.paired && <p className="capture-warning">Pair the extension first.</p>}
        {feedback === "error" && <p className="capture-warning">Could not queue this page.</p>}
      </section>

      <footer className="popup-footer">
        <span>{status.pending} pending · {status.failed} failed</span>
        <div>
          <button
            onClick={() => void chrome.runtime.sendMessage({ type: "SYNC_NOW" }).then(refresh)}
          >
            Sync
          </button>
          <button onClick={() => chrome.runtime.openOptionsPage()}>Settings</button>
        </div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
