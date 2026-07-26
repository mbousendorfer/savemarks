import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getSettings, setSettings } from "../lib/settings";
import "../ui.css";

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
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    void getSettings().then((settings) => {
      if (settings.serverUrl) setServerUrl(settings.serverUrl);
      setPaired(Boolean(settings.apiToken));
      setDiagnosticsEnabled(settings.diagnosticsEnabled);
      setSyncInterval(settings.syncIntervalMinutes);
    });
  }, []);

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
