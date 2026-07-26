import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getSettings, setSettings } from "../lib/settings";
import "../ui.css";

interface XImportState {
  status: "running" | "paused" | "complete" | "error" | "waiting";
  imported: number;
  pages: number;
  cursor?: string;
  error?: string;
}

function serverOriginPattern(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Server URL must use HTTP or HTTPS");
  }
  return `${url.origin}/*`;
}

function Options() {
  const [serverUrl, setServerUrl] = useState("http://localhost:3210");
  const [pairingCode, setPairingCode] = useState("");
  const [paired, setPaired] = useState(false);
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState(15);
  const [xImport, setXImport] = useState<XImportState>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    void getSettings().then((settings) => {
      if (settings.serverUrl) setServerUrl(settings.serverUrl);
      setPaired(Boolean(settings.apiToken));
      setDiagnosticsEnabled(settings.diagnosticsEnabled);
      setSyncInterval(settings.syncIntervalMinutes);
    });
    void chrome.storage.local.get("xImportState").then((stored) => {
      setXImport(stored.xImportState as XImportState | undefined);
    });
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === "local" && changes.xImportState) {
        setXImport(changes.xImportState.newValue as XImportState | undefined);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function xTabs(): Promise<chrome.tabs.Tab[]> {
    const tabs = await chrome.tabs.query({
      url: [
        "https://x.com/i/bookmarks*",
        "https://twitter.com/i/bookmarks*",
      ],
    });
    return tabs.sort(
      (left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0),
    );
  }

  async function startXImport(): Promise<void> {
    const tabs = await xTabs();
    const tab = tabs.find((candidate) => candidate.id !== undefined);
    if (!tab?.id) {
      setMessage("Open your X bookmarks page first, then try again.");
      return;
    }
    const cursor =
      xImport?.status === "paused" || xImport?.status === "error"
        ? xImport.cursor
        : undefined;
    await chrome.storage.local.set({
      xImportState: {
        status: "waiting",
        imported: xImport?.imported ?? 0,
        pages: xImport?.pages ?? 0,
        ...(cursor ? { cursor } : {}),
      },
    });
    await chrome.tabs.sendMessage(tab.id, {
      type: "START_X_IMPORT",
      cursor,
    });
    setMessage("Historical X import started.");
  }

  async function cancelXImport(): Promise<void> {
    const tabs = await xTabs();
    await Promise.all(
      tabs
        .filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined)
        .map((tab) =>
          chrome.tabs
            .sendMessage(tab.id, { type: "CANCEL_X_IMPORT" })
            .catch(() => undefined),
        ),
    );
  }

  async function pair(): Promise<void> {
    try {
      const pattern = serverOriginPattern(serverUrl);
      const granted = await chrome.permissions.request({ origins: [pattern] });
      if (!granted) throw new Error("Server access permission was not granted");
      const response = await fetch(
        `${serverUrl.replace(/\/$/, "")}/api/pairing/exchange`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: pairingCode.trim().toUpperCase(),
            clientName: `Chrome extension ${chrome.runtime.id.slice(0, 8)}`,
          }),
        },
      );
      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Pairing failed");
      }
      const payload = (await response.json()) as { token: string };
      await setSettings({ serverUrl, apiToken: payload.token });
      setPairingCode("");
      setPaired(true);
      setMessage("Extension paired successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pairing failed");
    }
  }

  async function save(): Promise<void> {
    await setSettings({
      diagnosticsEnabled,
      syncIntervalMinutes: syncInterval,
    });
    setMessage("Settings saved.");
  }

  return (
    <main style={{ maxWidth: 680, margin: "48px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>SaveMarks settings</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 28 }}>
        Configure the local SaveMarks server and the extraction spike.
      </p>

      <section className="panel" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Extension pairing</h2>
        <p className="muted" style={{ fontSize: 14 }}>
          Status: {paired ? "paired" : "not paired"}
        </p>
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="server">SaveMarks server URL</label>
          <input
            id="server"
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="code">Eight-character pairing code</label>
          <input
            id="code"
            autoComplete="off"
            value={pairingCode}
            onChange={(event) => setPairingCode(event.target.value)}
            maxLength={8}
          />
        </div>
        <button className="primary" onClick={() => void pair()}>
          Pair extension
        </button>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Synchronization</h2>
        <div style={{ marginBottom: 22 }}>
          <strong style={{ display: "block", marginBottom: 6 }}>
            X bookmark history
          </strong>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
            {xImport
              ? `${xImport.status} · ${xImport.imported} items · ${xImport.pages} pages`
              : "Ready to import your older bookmarks page by page."}
          </p>
          {xImport?.error && (
            <p style={{ color: "#9d2f24", fontSize: 13 }}>{xImport.error}</p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="primary"
              disabled={xImport?.status === "running"}
              onClick={() => void startXImport()}
            >
              {xImport?.status === "paused" || xImport?.status === "error"
                ? "Resume X import"
                : "Import X history"}
            </button>
            {(xImport?.status === "running" ||
              xImport?.status === "waiting") && (
              <button
                className="secondary"
                onClick={() => void cancelXImport()}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        <div className="field" style={{ marginBottom: 18 }}>
          <label htmlFor="interval">Interval in minutes</label>
          <input
            id="interval"
            type="number"
            min={5}
            max={1440}
            value={syncInterval}
            onChange={(event) => setSyncInterval(Number(event.target.value))}
          />
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={diagnosticsEnabled}
            onChange={(event) => setDiagnosticsEnabled(event.target.checked)}
          />
          Enable extraction diagnostics
        </label>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Disabled by default. When enabled, SaveMarks records only field names,
          redacted URLs, status codes, and detected operations on supported tabs.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button className="primary" onClick={() => void save()}>
            Save settings
          </button>
          <button
            className="secondary"
            onClick={() =>
              void chrome.tabs.create({
                url: chrome.runtime.getURL("src/diagnostics/index.html"),
              })
            }
          >
            Open diagnostics
          </button>
        </div>
      </section>
      {message && <p style={{ fontSize: 14 }}>{message}</p>}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Options />);
