import { exportFixture } from "@savemarks/extraction";
import {
  diagnosticEventSchema,
  type DiagnosticEvent,
} from "@savemarks/shared/messages";
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../ui.css";

function Diagnostics() {
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [filter, setFilter] = useState("");

  async function load(): Promise<void> {
    const stored = await chrome.storage.local.get("diagnosticEvents");
    const parsed = Array.isArray(stored.diagnosticEvents)
      ? stored.diagnosticEvents
          .map((event) => diagnosticEventSchema.safeParse(event))
          .filter((result) => result.success)
          .map((result) => result.data)
      : [];
    setEvents(parsed);
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const needle = filter.toLowerCase();
    if (!needle) return events;
    return events.filter((event) =>
      [
        event.sanitizedUrl,
        event.operationName,
        event.source,
        ...event.responseShape,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [events, filter]);

  function download(): void {
    const date = new Date().toISOString().slice(0, 10);
    const fixture = exportFixture(visible, date);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(fixture, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `savemarks-sanitized-${date}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ maxWidth: 1180, margin: "36px auto", padding: "0 20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Extraction diagnostics</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            {events.length} sanitized events stored locally in the extension
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="secondary" onClick={() => void load()}>
            Refresh
          </button>
          <button className="primary" onClick={download}>
            Export visible fixture
          </button>
          <button
            className="secondary"
            onClick={() =>
              void chrome.storage.local
                .set({ diagnosticEvents: [], capturedTemplates: [] })
                .then(load)
            }
          >
            Clear
          </button>
        </div>
      </header>

      <input
        aria-label="Filter diagnostics"
        placeholder="Filter by URL fragment, operation, field, or source"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        style={{
          width: "100%",
          margin: "22px 0 14px",
          border: "1px solid #d6d7d1",
          borderRadius: 9,
          padding: 12,
        }}
      />

      <div style={{ display: "grid", gap: 10 }}>
        {visible.map((event) => (
          <article className="panel" key={event.id}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <strong>{event.source.toUpperCase()}</strong>
              <code>{event.method}</code>
              <span>{event.status}</span>
              {event.operationName && <code>{event.operationName}</code>}
              {event.mutation && <span>Detected {event.mutation}</span>}
              {event.cursorPaths.length > 0 && (
                <span>{event.cursorPaths.length} cursor path(s)</span>
              )}
            </div>
            <p
              className="muted"
              style={{ overflowWrap: "anywhere", fontSize: 12 }}
            >
              {event.sanitizedUrl}
            </p>
            <details>
              <summary>Response shape ({event.responseShape.length} fields)</summary>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 11,
                  maxHeight: 260,
                  overflow: "auto",
                }}
              >
                {event.responseShape.join("\n")}
              </pre>
            </details>
          </article>
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Diagnostics />);
