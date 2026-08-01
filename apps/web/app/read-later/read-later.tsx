"use client";

import {
  ArchiveIcon,
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  BookOpenTextIcon,
  BookmarksIcon,
  CheckCircleIcon,
  InstagramLogoIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
  TagIcon,
  UploadSimpleIcon,
  XIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import Papa from "papaparse";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "../client-http";
import { MobileDock } from "../mobile-dock";

interface ReadLaterItem {
  id: string;
  canonicalUrl: string;
  savedAt: string;
  readAt: string | null;
  archived: boolean;
  title: string | null;
  description: string | null;
  siteName: string | null;
  author: string | null;
  enrichmentStatus: "pending" | "processing" | "complete" | "failed";
  lastError: string | null;
  tags: string[];
  imageUrl: string | null;
}

type Status = "unread" | "read" | "all" | "archived";
type Theme = "light" | "dark";
type TargetField =
  | "url"
  | "title"
  | "description"
  | "siteName"
  | "author"
  | "imageUrl"
  | "tags"
  | "status"
  | "savedAt";

const TARGETS: Array<[TargetField, string]> = [
  ["url", "URL"],
  ["title", "Title"],
  ["description", "Description"],
  ["siteName", "Site"],
  ["author", "Author"],
  ["imageUrl", "Image URL"],
  ["tags", "Tags"],
  ["status", "Status"],
  ["savedAt", "Saved date"],
];

const SYNONYMS: Record<TargetField, string[]> = {
  url: ["url", "link", "href", "address"],
  title: ["title", "name"],
  description: ["description", "excerpt", "summary"],
  siteName: ["site", "site_name", "domain", "publisher"],
  author: ["author", "byline", "creator"],
  imageUrl: ["image", "image_url", "thumbnail", "cover"],
  tags: ["tags", "tag", "labels", "label"],
  status: ["status", "state", "read"],
  savedAt: ["saved_at", "saved", "created_at", "date", "time_added"],
};

function splitTags(value: string) {
  return [
    ...new Set(
      value
        .split(/[,;]/)
        .map((tag) => tag.trim().replace(/^#+/, "").toLocaleLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 20);
}

function normalizedStatus(value: string) {
  const key = value.trim().toLocaleLowerCase();
  if (["read", "done", "finished", "lu", "terminé", "termine"].includes(key))
    return "read";
  if (["archived", "archive", "archivé", "archivee"].includes(key))
    return "archived";
  if (["unread", "to read", "à lire", "a lire", "pending", ""].includes(key))
    return key ? "unread" : undefined;
  return undefined;
}

function normalizeForDuplicate(value: string) {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (
      key.toLowerCase().startsWith("utm_") ||
      ["s", "t", "igsh", "igshid"].includes(key.toLowerCase())
    ) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

function validHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function ThemeButton() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const stored = localStorage.getItem("savemarks-theme");
    const resolved =
      stored === "dark" || stored === "light"
        ? stored
        : matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(resolved);
    document.documentElement.dataset.theme = resolved;
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("savemarks-theme", next);
    document.documentElement.dataset.theme = next;
  }
  return (
    <button
      className="rl-icon-button"
      onClick={toggle}
      aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}

function AddPanel({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [tab, setTab] = useState<"link" | "import">("link");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<TargetField, number>>>(
    {},
  );
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<Array<{ row: number; error: string }>>(
    [],
  );
  const inputRef = useRef<HTMLInputElement>(null);

  async function addLink() {
    if (!validHttpUrl(url)) return setMessage("Enter a valid HTTP(S) address.");
    setBusy(true);
    setMessage("");
    try {
      await fetchJson(
        "/api/read-later",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            clientItemId: crypto.randomUUID(),
            mode: "save",
            item: { url, tags: splitTags(tags) },
          }),
        },
        "The link could not be saved.",
      );
      onComplete();
      onClose();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The link could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadFile(file: File) {
    setMessage("");
    setErrors([]);
    if (file.size > 10 * 1024 * 1024)
      return setMessage("File exceeds the 10 MB limit.");
    const text = await file.text();
    setFileName(file.name);
    if (file.name.toLowerCase().endsWith(".txt")) {
      const values = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (values.length > 25_000)
        return setMessage("File exceeds the 25,000 row limit.");
      setHeaders(["url"]);
      setRows(values.map((value) => [value]));
      setMapping({ url: 0 });
      return;
    }
    const result = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    const [first = [], ...data] = result.data;
    if (data.length > 25_000)
      return setMessage("File exceeds the 25,000 row limit.");
    const cleanHeaders = first.map((value, index) =>
      (value || `column_${index + 1}`).replace(/^\uFEFF/, "").trim(),
    );
    const detected: Partial<Record<TargetField, number>> = {};
    for (const [target] of TARGETS) {
      const index = cleanHeaders.findIndex((header) =>
        SYNONYMS[target].includes(
          header.toLocaleLowerCase().replace(/\s+/g, "_"),
        ),
      );
      if (index >= 0) detected[target] = index;
    }
    setHeaders(cleanHeaders);
    setRows(data);
    setMapping(detected);
    if (result.errors.length)
      setMessage(`${result.errors.length} parsing warning(s) detected.`);
  }

  const prepared = useMemo(() => {
    const valid: Array<{ row: number; item: Record<string, unknown> }> = [];
    const invalid: Array<{ row: number; error: string }> = [];
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      const value = (field: TargetField) => {
        const column = mapping[field];
        return column === undefined ? "" : (row[column] ?? "").trim();
      };
      const address = value("url");
      if (!validHttpUrl(address))
        return invalid.push({ row: index + 2, error: "Invalid URL" });
      const identity = normalizeForDuplicate(address);
      if (seen.has(identity))
        return invalid.push({ row: index + 2, error: "Duplicate in file" });
      seen.add(identity);
      const savedAt = value("savedAt");
      if (savedAt && Number.isNaN(new Date(savedAt).getTime()))
        return invalid.push({ row: index + 2, error: "Invalid ISO date" });
      const statusValue = value("status");
      const status = normalizedStatus(statusValue);
      if (statusValue && !status)
        return invalid.push({ row: index + 2, error: "Unknown status" });
      const metadata = Object.fromEntries(
        (["title", "description", "siteName", "author", "imageUrl"] as const)
          .map((field) => [field, value(field)])
          .filter(([, fieldValue]) => fieldValue),
      );
      valid.push({
        row: index + 2,
        item: {
          url: address,
          tags: splitTags(value("tags")),
          ...(Object.keys(metadata).length ? { metadata } : {}),
          ...(status ? { status } : {}),
          ...(savedAt ? { savedAt: new Date(savedAt).toISOString() } : {}),
        },
      });
    });
    return { valid, invalid };
  }, [mapping, rows]);

  async function runImport() {
    if (!mapping.url && mapping.url !== 0)
      return setMessage("Map an URL column first.");
    setBusy(true);
    const failures = [...prepared.invalid];
    let completed = 0;
    let created = 0;
    let updated = 0;
    let serverFailures = 0;
    for (let offset = 0; offset < prepared.valid.length; offset += 100) {
      const batch = prepared.valid.slice(offset, offset + 100);
      try {
        const payload = await fetchJson<{
          results: Array<{ row: number; status: string; error?: string }>;
        }>(
          "/api/read-later/import",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items: batch }),
          },
          "Import batch failed.",
        );
        created += payload.results.filter(
          (entry) => entry.status === "created",
        ).length;
        updated += payload.results.filter(
          (entry) => entry.status === "updated",
        ).length;
        const invalid = payload.results.filter(
          (entry) => entry.status === "invalid",
        );
        serverFailures += invalid.length;
        failures.push(
          ...invalid.map((entry) => ({
            row: entry.row,
            error: entry.error ?? "Invalid row",
          })),
        );
      } catch (error) {
        serverFailures += batch.length;
        const reason =
          error instanceof Error ? error.message : "Import batch failed.";
        failures.push(
          ...batch.map((entry) => ({ row: entry.row, error: reason })),
        );
      }
      completed += batch.length;
      setProgress(
        Math.round((completed / Math.max(1, prepared.valid.length)) * 100),
      );
    }
    setErrors(failures);
    setBusy(false);
    setMessage(
      `Import complete · ${created} created · ${updated} updated · ${prepared.invalid.length + serverFailures} skipped`,
    );
    onComplete();
  }

  function downloadErrors() {
    const csv = Papa.unparse(
      errors.map((error) => ({ row: error.row, error: error.error })),
    );
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    anchor.download = "savemarks-import-errors.csv";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  function downloadTemplate() {
    const sample = Papa.unparse([
      {
        url: "https://example.com/article",
        title: "An article worth reading",
        description: "Optional summary",
        site_name: "Example",
        author: "Ada Lovelace",
        image_url: "https://example.com/cover.jpg",
        tags: "research; inspiration",
        status: "unread",
        saved_at: new Date().toISOString(),
      },
    ]);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(
      new Blob([sample], { type: "text/csv;charset=utf-8" }),
    );
    anchor.download = "savemarks-read-later-template.csv";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  return (
    <div
      className="rl-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add a Web link"
    >
      <section className="rl-add-panel">
        <header>
          <div>
            <p className="eyebrow">Read later</p>
            <h2>Add to Web</h2>
          </div>
          <button
            className="rl-icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon size={20} />
          </button>
        </header>
        <div className="rl-tabs">
          <button
            className={tab === "link" ? "active" : ""}
            onClick={() => setTab("link")}
          >
            <PlusIcon /> One link
          </button>
          <button
            className={tab === "import" ? "active" : ""}
            onClick={() => setTab("import")}
          >
            <UploadSimpleIcon /> Import
          </button>
        </div>
        {tab === "link" ? (
          <div className="rl-form">
            <label>
              URL
              <input
                autoFocus
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/article"
              />
            </label>
            <label>
              Tags <span>optional</span>
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="design, research"
              />
            </label>
            <button
              className="rl-primary"
              disabled={busy}
              onClick={() => void addLink()}
            >
              {busy ? "Saving…" : "Save link"}
            </button>
          </div>
        ) : (
          <div className="rl-import">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              hidden
              onChange={(event) =>
                event.target.files?.[0] && void loadFile(event.target.files[0])
              }
            />
            {!rows.length ? (
              <>
                <button
                  className="rl-dropzone"
                  onClick={() => inputRef.current?.click()}
                >
                  <UploadSimpleIcon size={28} />
                  <strong>Choose CSV or TXT</strong>
                  <span>Up to 10 MB · 25,000 rows</span>
                </button>
                <button className="rl-text-button" onClick={downloadTemplate}>
                  Download SaveMarks CSV template
                </button>
              </>
            ) : (
              <>
                <div className="rl-import-summary">
                  <strong>{fileName}</strong>
                  <span>
                    {prepared.valid.length} valid · {prepared.invalid.length}{" "}
                    skipped
                  </span>
                </div>
                <div className="rl-mapping">
                  {TARGETS.map(([target, label]) => (
                    <label key={target}>
                      <span>
                        {label}
                        {target === "url" ? " *" : ""}
                      </span>
                      <select
                        value={mapping[target] ?? ""}
                        onChange={(event) =>
                          setMapping((current) => ({
                            ...current,
                            [target]:
                              event.target.value === ""
                                ? undefined
                                : Number(event.target.value),
                          }))
                        }
                      >
                        <option value="">Not mapped</option>
                        {headers.map((header, index) => (
                          <option key={`${header}-${index}`} value={index}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="rl-preview-table">
                  <table>
                    <thead>
                      <tr>
                        {headers.slice(0, 5).map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, index) => (
                        <tr key={index}>
                          {row.slice(0, 5).map((value, cell) => (
                            <td key={cell}>{value}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="rl-primary"
                  disabled={busy || !prepared.valid.length}
                  onClick={() => void runImport()}
                >
                  {busy
                    ? `Importing ${progress}%`
                    : `Import ${prepared.valid.length} links`}
                </button>
              </>
            )}
          </div>
        )}
        {message && <p className="rl-message">{message}</p>}
        {errors.length > 0 && (
          <button className="rl-text-button" onClick={downloadErrors}>
            Download error report
          </button>
        )}
      </section>
    </div>
  );
}

export function ReadLater() {
  const [items, setItems] = useState<ReadLaterItem[]>([]);
  const [status, setStatus] = useState<Status>("unread");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [editTags, setEditTags] = useState("");
  const [loadError, setLoadError] = useState<string>();
  const loadRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (append = false, pageCursor?: string | null) => {
      setLoading(true);
      setLoadError(undefined);
      const params = new URLSearchParams({
        status,
        sort,
        q: query,
        limit: "30",
      });
      if (tag !== "all") params.set("tag", tag);
      if (append && pageCursor) params.set("cursor", pageCursor);
      try {
        const payload = await fetchJson<{
          items: ReadLaterItem[];
          nextCursor: string | null;
          unreadCount: number;
        }>(
          `/api/read-later?${params}`,
          undefined,
          "The Web library could not be loaded.",
        );
        setItems((current) =>
          append ? [...current, ...payload.items] : payload.items,
        );
        setCursor(payload.nextCursor);
        setUnreadCount(payload.unreadCount);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "The Web library could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    },
    [query, sort, status, tag],
  );

  const availableTags = useMemo(
    () =>
      [
        ...new Set([
          ...items.flatMap((item) => item.tags),
          ...(tag === "all" ? [] : [tag]),
        ]),
      ].sort(),
    [items, tag],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(false), 180);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const target = loadRef.current;
    if (!target || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) void load(true, cursor);
      },
      { rootMargin: "300px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [cursor, load, loading]);

  async function patchItem(
    id: string,
    update: { read?: boolean; archived?: boolean },
  ) {
    try {
      await fetchJson(
        `/api/bookmarks/${id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(update),
        },
        "The link could not be updated.",
      );
      await load(false);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "The link could not be updated.",
      );
    }
  }

  async function saveTags(id: string) {
    const next = splitTags(editTags);
    try {
      await fetchJson(
        `/api/bookmarks/${id}/tags`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tags: next }),
        },
        "The tags could not be saved.",
      );
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, tags: next } : item,
        ),
      );
      setEditing(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "The tags could not be saved.",
      );
    }
  }

  return (
    <main className="app-shell rl-shell">
      <aside className="sidebar rl-sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <BookmarksIcon size={19} weight="fill" />
          </span>
          <span className="brand-copy">
            <strong>SaveMarks</strong>
            <small>local archive</small>
          </span>
        </a>
        <nav className="sidebar-nav" aria-label="Library navigation">
          <div className="sidebar-section">
            <p>Workspace</p>
            <a href="/">
              <BookmarksIcon size={16} />
              <span>All</span>
            </a>
          </div>
          <div className="sidebar-section">
            <p>Sources</p>
            <a href="/?source=x">
              <XLogoIcon size={16} />
              <span>X</span>
            </a>
            <a href="/?source=instagram">
              <InstagramLogoIcon size={16} />
              <span>Instagram</span>
            </a>
            <a className="active" href="/web" aria-current="page">
              <LinkIcon size={16} />
              <span>Web</span>
              <em>{unreadCount}</em>
            </a>
          </div>
          <div className="sidebar-section">
            <p>Status</p>
            {(
              [
                ["unread", BookOpenTextIcon],
                ["read", CheckCircleIcon],
                ["all", BookmarksIcon],
                ["archived", ArchiveIcon],
              ] as Array<[Status, typeof BookOpenTextIcon]>
            ).map(([value, Icon]) => (
              <button
                key={value}
                className={status === value ? "active" : ""}
                onClick={() => setStatus(value)}
              >
                <Icon size={16} />
                <span>
                  {value === "unread"
                    ? "To read"
                    : value === "read"
                      ? "Finished"
                      : value[0]!.toUpperCase() + value.slice(1)}
                </span>
                {value === "unread" && <em>{unreadCount}</em>}
              </button>
            ))}
          </div>
        </nav>
        <div className="sidebar-footer">
          <span className="rl-local-note">
            Preview images stay on your server.
          </span>
        </div>
      </aside>

      <section className="workspace rl-workspace">
        <div className="workspace-bar">
          <div className="workspace-path">
            <span>savemarks</span>
            <b>/</b>
            <strong>web</strong>
          </div>
          <div className="workspace-tools">
            <ThemeButton />
            <button
              className="rl-primary rl-add-button"
              onClick={() => setAdding(true)}
            >
              <PlusIcon size={17} /> Add
            </button>
          </div>
        </div>
        <header className="library-header rl-header">
          <div>
            <p className="eyebrow">Source / 03</p>
            <h1>Web</h1>
            <p className="result-count">
              {items.length} loaded · {status} · read later
            </p>
          </div>
          <div className="rl-header-mark">
            <LinkIcon size={32} />
          </div>
        </header>
        <div className="command-row rl-command">
          <label className="search">
            <MagnifyingGlassIcon size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, sites, excerpts…"
            />
            {query && (
              <button onClick={() => setQuery("")}>
                <XIcon size={15} />
              </button>
            )}
          </label>
          <select
            className="rl-select"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          >
            <option value="all">All tags</option>
            {availableTags.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className="rl-select"
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as "newest" | "oldest")
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        <div className="rl-status-strip">
          {(["unread", "read", "all", "archived"] as Status[]).map((value) => (
            <button
              key={value}
              className={status === value ? "active" : ""}
              onClick={() => setStatus(value)}
            >
              {value === "unread"
                ? "To read"
                : value === "read"
                  ? "Finished"
                  : value}
            </button>
          ))}
        </div>

        <section className="rl-list" aria-live="polite">
          {loadError && (
            <div className="rl-message" role="alert">
              {loadError}
            </div>
          )}
          {items.map((item, index) => (
            <article
              className="rl-card"
              key={item.id}
              style={{ animationDelay: `${Math.min(index, 10) * 22}ms` }}
            >
              <a
                className="rl-thumb"
                href={item.canonicalUrl}
                target="_blank"
                rel="noreferrer"
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span>
                    {(item.siteName ?? new URL(item.canonicalUrl).hostname)
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                )}
              </a>
              <div className="rl-card-body">
                <div className="rl-card-meta">
                  <span>
                    {item.siteName ?? new URL(item.canonicalUrl).hostname}
                  </span>
                  <i>·</i>
                  <time>
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                    }).format(new Date(item.savedAt))}
                  </time>
                  {item.enrichmentStatus !== "complete" && (
                    <em className={`rl-state ${item.enrichmentStatus}`}>
                      {item.enrichmentStatus}
                    </em>
                  )}
                </div>
                <h2>
                  <a href={item.canonicalUrl} target="_blank" rel="noreferrer">
                    {item.title ?? item.canonicalUrl}
                  </a>
                </h2>
                {item.description && <p>{item.description}</p>}
                <div className="rl-tags">
                  {item.tags.map((tag) => (
                    <span key={tag}>
                      <TagIcon size={12} />
                      {tag}
                    </span>
                  ))}
                </div>
                {editing === item.id && (
                  <div className="rl-edit-tags">
                    <input
                      autoFocus
                      value={editTags}
                      onChange={(event) => setEditTags(event.target.value)}
                      onKeyDown={(event) =>
                        event.key === "Enter" && void saveTags(item.id)
                      }
                    />
                    <button onClick={() => void saveTags(item.id)}>Save</button>
                  </div>
                )}
              </div>
              <div className="rl-actions">
                <a
                  href={item.canonicalUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open original"
                >
                  <ArrowSquareOutIcon size={18} />
                </a>
                <button
                  onClick={() =>
                    void patchItem(item.id, { read: !item.readAt })
                  }
                  title={item.readAt ? "Mark unread" : "Mark finished"}
                >
                  <CheckCircleIcon
                    size={18}
                    weight={item.readAt ? "fill" : "regular"}
                  />
                </button>
                <button
                  onClick={() => {
                    setEditing(item.id);
                    setEditTags(item.tags.join(", "));
                  }}
                  title="Edit tags"
                >
                  <TagIcon size={18} />
                </button>
                {item.enrichmentStatus === "failed" && (
                  <button
                    onClick={() =>
                      void fetch(`/api/read-later/${item.id}/retry`, {
                        method: "POST",
                      }).then(() => load(false))
                    }
                    title="Retry enrichment"
                  >
                    <ArrowClockwiseIcon size={18} />
                  </button>
                )}
                <button
                  onClick={() =>
                    void patchItem(item.id, { archived: !item.archived })
                  }
                  title="Archive"
                >
                  <ArchiveIcon size={18} />
                </button>
              </div>
            </article>
          ))}
          {!loading && !items.length && (
            <div className="empty-state">
              <LinkIcon size={30} />
              <h2>Your Web library is empty</h2>
              <p>Add a link, import a CSV, or use the extension.</p>
              <button className="rl-primary" onClick={() => setAdding(true)}>
                <PlusIcon /> Add your first link
              </button>
            </div>
          )}
          {loading && !items.length && (
            <div className="rl-loading">Loading your queue…</div>
          )}
          <div ref={loadRef} className="rl-load-sentinel">
            {loading && items.length > 0 ? "Loading more…" : ""}
          </div>
        </section>
      </section>

      <MobileDock active="web" />
      {adding && (
        <AddPanel
          onClose={() => setAdding(false)}
          onComplete={() => void load(false)}
        />
      )}
    </main>
  );
}
