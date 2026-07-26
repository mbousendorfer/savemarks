import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getSettings } from "../lib/settings";
import "../ui.css";

interface Status {
  paired: boolean;
  server: "not configured" | "checking" | "online" | "offline";
  pending: number;
  failed: number;
  xActive: boolean;
  instagramActive: boolean;
  lastSuccessfulSync?: string;
}

function Popup() {
  const [status, setStatus] = useState<Status>({
    paired: false,
    server: "not configured",
    pending: 0,
    failed: 0,
    xActive: false,
    instagramActive: false,
  });

  async function refresh(): Promise<void> {
    const settings = await getSettings();
    const stats = (await chrome.runtime.sendMessage({
      type: "QUEUE_STATS",
    })) as { pending: number; failed: number };
    const sourceStatus = await chrome.storage.local.get([
      "xAdapterActive",
      "instagramAdapterActive",
    ]);
    const next: Status = {
      paired: Boolean(settings.apiToken),
      server: settings.serverUrl ? "checking" : "not configured",
      pending: stats.pending,
      failed: stats.failed,
      xActive: sourceStatus.xAdapterActive === true,
      instagramActive: sourceStatus.instagramAdapterActive === true,
      ...(settings.lastSuccessfulSync
        ? { lastSuccessfulSync: settings.lastSuccessfulSync }
        : {}),
    };
    setStatus(next);
    if (settings.serverUrl) {
      try {
        const response = await fetch(
          `${settings.serverUrl.replace(/\/$/, "")}/api/health`,
        );
        setStatus((current) => ({
          ...current,
          server: response.ok ? "online" : "offline",
        }));
      } catch {
        setStatus((current) => ({ ...current, server: "offline" }));
      }
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <main style={{ width: 330, padding: 14 }}>
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong>SaveMarks</strong>
          <span className="muted" style={{ fontSize: 12 }}>
            {status.server}
          </span>
        </div>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "10px 16px",
            margin: "20px 0",
            fontSize: 13,
          }}
        >
          <dt className="muted">Pairing</dt>
          <dd>{status.paired ? "Connected" : "Required"}</dd>
          <dt className="muted">Pending</dt>
          <dd>{status.pending}</dd>
          <dt className="muted">Failed</dt>
          <dd>{status.failed}</dd>
          <dt className="muted">X</dt>
          <dd>{status.xActive ? "Active" : "Waiting for bookmarks page"}</dd>
          <dt className="muted">Instagram</dt>
          <dd>
            {status.instagramActive ? "Active" : "Awaiting live spike"}
          </dd>
        </dl>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="primary"
            onClick={() =>
              void chrome.runtime
                .sendMessage({ type: "SYNC_NOW" })
                .then(refresh)
            }
          >
            Sync queue
          </button>
          <button className="secondary" onClick={() => chrome.runtime.openOptionsPage()}>
            Settings
          </button>
        </div>
        {status.lastSuccessfulSync && (
          <p className="muted" style={{ fontSize: 11, marginBottom: 0 }}>
            Last sync {new Date(status.lastSuccessfulSync).toLocaleString()}
          </p>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
