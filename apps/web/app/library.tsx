"use client";

import {
  ArchiveIcon,
  ArrowSquareOutIcon,
  BookmarksIcon,
  CheckIcon,
  CopyIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  ArticleIcon,
  FolderSimpleIcon,
  FunnelSimpleIcon,
  GridFourIcon,
  HashIcon,
  ImageIcon,
  InstagramLogoIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  MonitorIcon,
  RowsIcon,
  SunIcon,
  TagIcon,
  TextTIcon,
  TrashIcon,
  VideoCameraIcon,
  XIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "./client-http";
import { MobileDock } from "./mobile-dock";

const INITIAL_RENDER_COUNT = 48;
const RENDER_BATCH_SIZE = 48;
const UNTAGGED_FILTER = "__untagged__";

type Source = "x" | "instagram";
type ContentType =
  "text" | "image" | "video" | "carousel" | "reel" | "thread" | "quote";

interface LibraryMedia {
  id: string;
  url: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  position: number;
}

export interface LibraryBookmark {
  id: string;
  source: Source;
  sourceItemId: string;
  canonicalUrl: string;
  contentType: ContentType;
  text: string | null;
  caption: string | null;
  publishedAt: string | null;
  savedAt: string | null;
  importedAt: string;
  archived: boolean;
  tags: string[];
  author: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  media: LibraryMedia[];
}

type Filter =
  | "all"
  | Source
  | "images"
  | "videos"
  | "carousels"
  | "reels"
  | "text"
  | "archived";
type View = "grid" | "list";
type Sort =
  | "saved-newest"
  | "saved-oldest"
  | "published-newest"
  | "published-oldest"
  | "author-az";
type Period = "anytime" | "7d" | "30d" | "90d" | "year";
type ThemePreference = "system" | "light" | "dark";

const sortLabels: Record<Sort, string> = {
  "saved-newest": "Recently added",
  "saved-oldest": "Oldest added",
  "published-newest": "Newest published",
  "published-oldest": "Oldest published",
  "author-az": "Author A–Z",
};

const periodLabels: Record<Period, string> = {
  anytime: "Any time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  year: "Last year",
};

const filterLabels: Record<Filter, string> = {
  all: "All",
  x: "X",
  instagram: "Instagram",
  images: "Images",
  videos: "Videos",
  carousels: "Carousels",
  reels: "Reels",
  text: "Text",
  archived: "Archived",
};

function formatDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function cardDate(
  bookmark: LibraryBookmark,
  sort: Sort,
): { label: string; value: string } {
  if (sort.startsWith("published")) {
    return {
      label: "Published",
      value: bookmark.publishedAt
        ? formatDate(bookmark.publishedAt)
        : "Unknown",
    };
  }
  return {
    label: "Added",
    value: formatDate(bookmark.savedAt ?? bookmark.importedAt),
  };
}

function savedTime(bookmark: LibraryBookmark): number {
  return new Date(
    bookmark.savedAt ?? bookmark.publishedAt ?? bookmark.importedAt,
  ).getTime();
}

function compareOptionalDates(
  left: string | null,
  right: string | null,
  direction: "newest" | "oldest",
): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const difference = new Date(left).getTime() - new Date(right).getTime();
  return direction === "oldest" ? difference : -difference;
}

function primaryMedia(bookmark: LibraryBookmark): LibraryMedia | undefined {
  const sorted = [...bookmark.media].sort(
    (left, right) => left.position - right.position,
  );
  if (bookmark.contentType === "video" || bookmark.contentType === "reel") {
    return (
      sorted.find((media) => media.mimeType?.startsWith("image/")) ??
      sorted.find((media) => !media.mimeType?.startsWith("video/"))
    );
  }
  return sorted.find((media) => !media.mimeType?.startsWith("video/"));
}

function bookmarkHost(canonicalUrl: string): string {
  try {
    return new URL(canonicalUrl).hostname.replace(/^www\./, "");
  } catch {
    return canonicalUrl;
  }
}

function matchesFilter(bookmark: LibraryBookmark, filter: Filter): boolean {
  if (filter === "all") return !bookmark.archived;
  if (filter === "archived") return bookmark.archived;
  if (filter === "x" || filter === "instagram") {
    return bookmark.source === filter && !bookmark.archived;
  }
  if (filter === "images") {
    return bookmark.contentType === "image" && !bookmark.archived;
  }
  if (filter === "videos") {
    return bookmark.contentType === "video" && !bookmark.archived;
  }
  if (filter === "carousels") {
    return bookmark.contentType === "carousel" && !bookmark.archived;
  }
  if (filter === "reels") {
    return bookmark.contentType === "reel" && !bookmark.archived;
  }
  return (
    ["text", "thread", "quote"].includes(bookmark.contentType) &&
    !bookmark.archived
  );
}

function SourceMark({ source }: { source: Source }) {
  return source === "x" ? (
    <XLogoIcon className="source-icon" size={15} weight="regular" />
  ) : (
    <InstagramLogoIcon className="source-icon" size={15} weight="bold" />
  );
}

function Avatar({ url, username }: { url: string | null; username: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [url]);

  if (url && !failed) {
    return (
      <img
        className="avatar"
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className="avatar avatar--fallback" aria-hidden="true">
      {username.slice(0, 1).toUpperCase()}
    </span>
  );
}

function BookmarkCard({
  bookmark,
  view,
  sort,
  selected,
  selectionMode,
  onOpen,
  onToggleSelected,
  onArchive,
  onDelete,
  onAddTag,
}: {
  bookmark: LibraryBookmark;
  view: View;
  sort: Sort;
  selected: boolean;
  selectionMode: boolean;
  onOpen: () => void;
  onToggleSelected: () => void;
  onArchive: () => Promise<unknown>;
  onDelete: () => void;
  onAddTag: (tag: string) => Promise<unknown>;
}) {
  const [tagging, setTagging] = useState(false);
  const [quickTag, setQuickTag] = useState("");
  const [busy, setBusy] = useState(false);
  const media = primaryMedia(bookmark);
  const copy = bookmark.text ?? bookmark.caption;
  const isTextual = !media;
  const date = cardDate(bookmark, sort);

  return (
    <article
      className={`bookmark-card bookmark-card--source-${bookmark.source} ${isTextual ? "bookmark-card--text" : "bookmark-card--media"} ${
        view === "list" ? "bookmark-card--list" : ""
      } ${selected ? "bookmark-card--selected" : ""}`}
      onClick={selectionMode ? onToggleSelected : onOpen}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (selectionMode) onToggleSelected();
          else onOpen();
        }
      }}
    >
      <div
        className="card-quick-actions"
        aria-label="Bookmark actions"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <button
          className="card-select-action"
          aria-label={selected ? "Deselect bookmark" : "Select bookmark"}
          aria-pressed={selected}
          title={selected ? "Deselect" : "Select"}
          onClick={onToggleSelected}
        >
          {selected && <CheckIcon size={13} weight="bold" />}
        </button>
        <button
          aria-label="Add a tag"
          title="Add a tag"
          onClick={() => setTagging((current) => !current)}
        >
          <TagIcon size={15} />
        </button>
        <button
          aria-label={
            bookmark.archived ? "Restore bookmark" : "Archive bookmark"
          }
          title={bookmark.archived ? "Restore" : "Archive"}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onArchive().finally(() => setBusy(false));
          }}
        >
          <ArchiveIcon size={15} />
        </button>
        <button
          className="card-danger-action"
          aria-label="Delete bookmark"
          title="Delete"
          onClick={onDelete}
        >
          <TrashIcon size={15} />
        </button>
      </div>
      {tagging && (
        <form
          className="card-tag-popover"
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            const value = quickTag.trim().replace(/^#/, "").toLocaleLowerCase();
            if (!value) return;
            setBusy(true);
            void onAddTag(value).finally(() => {
              setBusy(false);
              setQuickTag("");
              setTagging(false);
            });
          }}
        >
          <TagIcon size={14} />
          <input
            autoFocus
            value={quickTag}
            disabled={busy}
            maxLength={50}
            placeholder="Tag name"
            aria-label="Tag name"
            onChange={(event) => setQuickTag(event.target.value)}
          />
          <button disabled={!quickTag.trim() || busy}>Add</button>
        </form>
      )}
      {view === "list" ? (
        <>
          <div className="card-list-thumbnail">
            {media ? (
              <img
                src={media.url}
                alt=""
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                referrerPolicy="no-referrer"
              />
            ) : bookmark.author.avatarUrl ? (
              <Avatar
                url={bookmark.author.avatarUrl}
                username={bookmark.author.username}
              />
            ) : (
              <span className="card-list-thumbnail-fallback" aria-hidden="true">
                <SourceMark source={bookmark.source} />
              </span>
            )}
          </div>
          <div className="card-list-content">
            <p className="card-list-title">
              {copy?.trim() ||
                bookmark.author.displayName ||
                `@${bookmark.author.username}`}
            </p>
            {bookmark.tags.length > 0 && (
              <div className="card-list-tags" aria-label="Tags">
                {bookmark.tags.slice(0, 3).map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            )}
            <div className="card-list-meta">
              <span>
                <FolderSimpleIcon size={18} />
                {bookmark.author.displayName ?? `@${bookmark.author.username}`}
              </span>
              <i aria-hidden="true" />
              <span>
                <ArticleIcon size={16} weight="fill" />
                {bookmarkHost(bookmark.canonicalUrl)}
              </span>
              <i aria-hidden="true" />
              <time
                dateTime={
                  sort.startsWith("published")
                    ? (bookmark.publishedAt ?? bookmark.importedAt)
                    : (bookmark.savedAt ?? bookmark.importedAt)
                }
                title={`${date.label}: ${date.value}`}
              >
                {date.value}
              </time>
            </div>
          </div>
        </>
      ) : (
        <>
          {media && (
            <div
              className="card-media"
              style={
                media.width && media.height
                  ? { aspectRatio: `${media.width}/${media.height}` }
                  : undefined
              }
            >
              {/* Remote media remains the fallback until the local downloader stores it. */}
              <img
                src={media.url}
                alt=""
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                referrerPolicy="no-referrer"
              />
              {(bookmark.contentType === "video" ||
                bookmark.contentType === "reel") && (
                <span className="media-type">
                  <VideoCameraIcon size={14} weight="fill" />
                  Video
                </span>
              )}
              {bookmark.contentType === "carousel" && (
                <span className="media-type">
                  <GridFourIcon size={14} weight="fill" />
                  {bookmark.media.length}
                </span>
              )}
            </div>
          )}
          <div className="card-body">
            <div className="card-author">
              <Avatar
                url={bookmark.author.avatarUrl}
                username={bookmark.author.username}
              />
              <div>
                <strong>
                  {bookmark.author.displayName ??
                    `@${bookmark.author.username}`}
                </strong>
                <span>@{bookmark.author.username}</span>
              </div>
              <span
                className="source-mark"
                data-source={bookmark.source}
                aria-label={bookmark.source === "x" ? "X" : "Instagram"}
                title={bookmark.source === "x" ? "X" : "Instagram"}
              >
                <SourceMark source={bookmark.source} />
              </span>
            </div>
            {copy && <p className="card-copy">{copy}</p>}
            {bookmark.tags.length > 0 && (
              <div className="card-tags">
                {bookmark.tags.slice(0, 4).map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            )}
            <div className="card-footer">
              <span>
                {date.label} · {date.value}
              </span>
              <span className="card-origin">
                <span>{bookmark.source === "x" ? "X" : "Instagram"}</span>
                <i aria-hidden="true" />
                {bookmark.contentType}
              </span>
            </div>
          </div>
        </>
      )}
    </article>
  );
}

function Detail({
  bookmark,
  onClose,
  onTagsChange,
  onArchivedChange,
}: {
  bookmark: LibraryBookmark;
  onClose: () => void;
  onTagsChange: (tags: string[]) => void;
  onArchivedChange: (archived: boolean) => void;
}) {
  const [tagValue, setTagValue] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  const [tagError, setTagError] = useState<string>();
  const [activeMedia, setActiveMedia] = useState(0);
  const [savingArchive, setSavingArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string>();
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  const sortedMedia = useMemo(
    () =>
      [...bookmark.media].sort((left, right) => left.position - right.position),
    [bookmark.media],
  );
  const media = sortedMedia[activeMedia] ?? primaryMedia(bookmark);
  const copy = bookmark.text ?? bookmark.caption;

  async function saveTags(nextTags: string[]): Promise<void> {
    setSavingTags(true);
    setTagError(undefined);
    try {
      const response = await fetch(`/api/bookmarks/${bookmark.id}/tags`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      });
      if (!response.ok) throw new Error("Could not save tags");
      const payload = (await response.json()) as { tags: string[] };
      onTagsChange(payload.tags);
      setTagValue("");
    } catch (error) {
      setTagError(
        error instanceof Error ? error.message : "Could not save tags",
      );
    } finally {
      setSavingTags(false);
    }
  }

  function addTag(): void {
    const name = tagValue.trim().toLocaleLowerCase();
    if (!name || bookmark.tags.includes(name)) {
      setTagValue("");
      return;
    }
    void saveTags([...bookmark.tags, name]);
  }

  async function toggleArchived(): Promise<void> {
    setSavingArchive(true);
    setArchiveError(undefined);
    try {
      const response = await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: !bookmark.archived }),
      });
      if (!response.ok) throw new Error("Could not update this bookmark");
      const payload = (await response.json()) as { archived: boolean };
      onArchivedChange(payload.archived);
    } catch (error) {
      setArchiveError(
        error instanceof Error
          ? error.message
          : "Could not update this bookmark",
      );
    } finally {
      setSavingArchive(false);
    }
  }

  return (
    <div className="detail-backdrop" onMouseDown={onClose}>
      <section
        className={`detail-panel ${
          media ? "detail-panel--media" : "detail-panel--text"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookmark-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="sheet-handle" aria-hidden="true" />
        <button className="detail-close" onClick={onClose} aria-label="Close">
          <span>Esc</span>
          <XIcon size={20} />
        </button>
        {media && (
          <div className="detail-media">
            {media.mimeType?.startsWith("video/") ? (
              <video src={media.url} controls preload="metadata" />
            ) : (
              <img src={media.url} alt="" referrerPolicy="no-referrer" />
            )}
            {sortedMedia.length > 1 && (
              <div className="media-strip" aria-label="Media gallery">
                {sortedMedia.map((item, index) => (
                  <button
                    key={item.id}
                    className={activeMedia === index ? "active" : ""}
                    onClick={() => setActiveMedia(index)}
                    aria-label={`Show media ${index + 1}`}
                    aria-pressed={activeMedia === index}
                  >
                    {item.mimeType?.startsWith("video/") ? (
                      <VideoCameraIcon size={18} weight="fill" />
                    ) : (
                      <img src={item.url} alt="" referrerPolicy="no-referrer" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div
          className="detail-content"
          tabIndex={0}
          aria-label="Scrollable bookmark details"
        >
          <header className="detail-header">
            <div className="detail-kicker">
              <span className="detail-source-icon">
                <SourceMark source={bookmark.source} />
              </span>
              <span>{bookmark.source}</span>
              <i aria-hidden="true" />
              <span>{bookmark.contentType}</span>
              {bookmark.archived && <em>Archived</em>}
            </div>
            <div className="detail-author">
              <Avatar
                url={bookmark.author.avatarUrl}
                username={bookmark.author.username}
              />
              <div>
                <h2 id="bookmark-detail-title">
                  {bookmark.author.displayName ??
                    `@${bookmark.author.username}`}
                </h2>
                <p className="detail-handle">@{bookmark.author.username}</p>
              </div>
            </div>
          </header>
          {copy && (
            <div className="detail-copy-frame">
              <p className="detail-copy">{copy}</p>
            </div>
          )}
          <div className="tag-editor" aria-label="Bookmark tags">
            <div className="detail-section-label">
              <span>Tags</span>
              <small>{bookmark.tags.length || "None"}</small>
            </div>
            <div className="tag-list">
              {bookmark.tags.map((tag) => (
                <button
                  key={tag}
                  disabled={savingTags}
                  onClick={() =>
                    void saveTags(
                      bookmark.tags.filter((value) => value !== tag),
                    )
                  }
                  title={`Remove ${tag}`}
                >
                  <TagIcon size={13} weight="fill" />
                  {tag}
                  <XIcon size={11} />
                </button>
              ))}
            </div>
            <div className="tag-input">
              <TagIcon size={16} />
              <input
                value={tagValue}
                disabled={savingTags}
                maxLength={50}
                placeholder="Add a tag…"
                onChange={(event) => setTagValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addTag();
                  }
                }}
              />
              <button
                disabled={!tagValue.trim() || savingTags}
                onClick={addTag}
              >
                Add
              </button>
            </div>
            {tagError && <p className="tag-error">{tagError}</p>}
          </div>
          <dl className="detail-meta">
            <div>
              <dt>Published</dt>
              <dd>
                {bookmark.publishedAt
                  ? formatDate(bookmark.publishedAt)
                  : "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Added</dt>
              <dd>{formatDate(bookmark.savedAt ?? bookmark.importedAt)}</dd>
            </div>
          </dl>
          <details className="detail-technical">
            <summary>Technical details</summary>
            <dl>
              <div>
                <dt>Media</dt>
                <dd>{bookmark.media.length || "None"}</dd>
              </div>
              <div>
                <dt>Imported</dt>
                <dd>{formatDate(bookmark.importedAt)}</dd>
              </div>
              <div>
                <dt>Source ID</dt>
                <dd>{bookmark.sourceItemId}</dd>
              </div>
            </dl>
          </details>
          <footer className="detail-actions-wrap">
            <div className="detail-actions">
              <a
                className="original-link"
                href={bookmark.canonicalUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open original
                <ArrowSquareOutIcon size={17} />
              </a>
              <button
                className="archive-button"
                disabled={savingArchive}
                onClick={() => void toggleArchived()}
              >
                <ArchiveIcon size={16} />
                {bookmark.archived ? "Restore" : "Archive"}
              </button>
            </div>
            {archiveError && <p className="tag-error">{archiveError}</p>}
          </footer>
        </div>
      </section>
    </div>
  );
}

function PairingDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();

  async function generate() {
    setError(undefined);
    const response = await fetch("/api/pairing/code", { method: "POST" });
    if (!response.ok) {
      setError("Could not generate a pairing code.");
      return;
    }
    const payload = (await response.json()) as { code: string };
    setCode(payload.code);
  }

  return (
    <div className="detail-backdrop pairing-backdrop" onMouseDown={onClose}>
      <section
        className="pairing-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pairing-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="sheet-handle" aria-hidden="true" />
        <button className="detail-close" onClick={onClose} aria-label="Close">
          <XIcon size={20} />
        </button>
        <div className="pairing-icon">
          <LinkIcon size={24} weight="bold" />
        </div>
        <p className="eyebrow">Browser connection</p>
        <h2 id="pairing-dialog-title">Pair the extension</h2>
        <p>Generate a single-use code, then enter it in SaveMarks Settings.</p>
        {code && (
          <button
            className="pairing-code"
            onClick={() => {
              void navigator.clipboard.writeText(code);
              setCopied(true);
            }}
          >
            <span>{code}</span>
            {copied ? <CheckIcon size={19} /> : <CopyIcon size={19} />}
          </button>
        )}
        {error && <p className="dialog-error">{error}</p>}
        <button className="button-dark" onClick={() => void generate()}>
          {code ? "Generate another code" : "Generate pairing code"}
        </button>
      </section>
    </div>
  );
}

function DeleteDialog({
  count,
  busy,
  onCancel,
  onConfirm,
}: {
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="detail-backdrop confirm-backdrop" onMouseDown={onCancel}>
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="confirm-icon">
          <TrashIcon size={20} />
        </span>
        <p className="eyebrow">Permanent action</p>
        <h2 id="delete-dialog-title">
          Delete {count} {count === 1 ? "bookmark" : "bookmarks"}?
        </h2>
        <p id="delete-dialog-description">
          The records will be removed permanently. Local media is deleted only
          when no other bookmark uses it.
        </p>
        <div className="confirm-actions">
          <button disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            className="confirm-delete"
            disabled={busy}
            onClick={onConfirm}
          >
            <TrashIcon size={16} />
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function Library({
  initialBookmarks,
  initialReadLaterCount,
  initialFilter,
}: {
  initialBookmarks: LibraryBookmark[];
  initialReadLaterCount: number;
  initialFilter?: Filter | undefined;
}) {
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [filter, setFilter] = useState<Filter>(initialFilter ?? "all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("grid");
  const [sort, setSort] = useState<Sort>("saved-newest");
  const [period, setPeriod] = useState<Period>("anytime");
  const [tag, setTag] = useState("all");
  const [selected, setSelected] = useState<LibraryBookmark>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string>();
  const [deleteIds, setDeleteIds] = useState<Set<string>>();
  const [pairing, setPairing] = useState(false);
  const [themePreference, setThemePreference] =
    useState<ThemePreference>("system");
  const [themeReady, setThemeReady] = useState(false);
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_COUNT);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFilter(initialFilter ?? "all");
  }, [initialFilter]);

  useEffect(() => setBookmarks(initialBookmarks), [initialBookmarks]);

  useEffect(() => {
    const stored = window.localStorage.getItem("savemarks-theme");
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemePreference(stored);
    }
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved =
        themePreference === "system"
          ? media.matches
            ? "dark"
            : "light"
          : themePreference;
      document.documentElement.dataset.theme = resolved;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", resolved === "dark" ? "#0a0c0a" : "#f5f6f2");
    };
    apply();
    window.localStorage.setItem("savemarks-theme", themePreference);
    if (themePreference !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [themePreference, themeReady]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    if (!selected && !pairing && !deleteIds) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [deleteIds, pairing, selected]);

  function toggleSelected(id: string): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulkAction(
    payload:
      | { action: "archive"; ids: string[]; archived: boolean }
      | { action: "add_tag"; ids: string[]; tag: string }
      | { action: "delete"; ids: string[] },
  ): Promise<boolean> {
    setBulkBusy(true);
    setBulkError(undefined);
    try {
      const result = await fetchJson<{ ids: string[] }>(
        "/api/bookmarks/bulk",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
        "The bookmark action could not be completed.",
      );
      const affected = new Set(result.ids);
      if (payload.action === "delete") {
        setBookmarks((current) =>
          current.filter((item) => !affected.has(item.id)),
        );
        setSelected((current) =>
          current && affected.has(current.id) ? undefined : current,
        );
      } else if (payload.action === "archive") {
        setBookmarks((current) =>
          current.map((item) =>
            affected.has(item.id)
              ? { ...item, archived: payload.archived }
              : item,
          ),
        );
      } else {
        setBookmarks((current) =>
          current.map((item) =>
            affected.has(item.id) && !item.tags.includes(payload.tag)
              ? { ...item, tags: [...item.tags, payload.tag].sort() }
              : item,
          ),
        );
      }
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of affected) next.delete(id);
        return next;
      });
      setBulkTag("");
      return true;
    } catch (error) {
      setBulkError(
        error instanceof Error ? error.message : "Bookmark action failed",
      );
      return false;
    } finally {
      setBulkBusy(false);
    }
  }

  const tagFacets = useMemo(() => {
    const facets = new Map<string, number>();
    for (const bookmark of bookmarks) {
      if (bookmark.archived) continue;
      for (const value of bookmark.tags) {
        facets.set(value, (facets.get(value) ?? 0) + 1);
      }
    }
    return [...facets.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [bookmarks]);
  const allTags = useMemo(
    () => tagFacets.map((facet) => facet.name),
    [tagFacets],
  );
  const untaggedCount = useMemo(
    () =>
      bookmarks.filter(
        (bookmark) => !bookmark.archived && bookmark.tags.length === 0,
      ).length,
    [bookmarks],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const periodDays: Partial<Record<Period, number>> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
      year: 365,
    };
    const cutoff = periodDays[period]
      ? Date.now() - periodDays[period]! * 86_400_000
      : undefined;
    const filtered = bookmarks.filter((bookmark) => {
      if (!matchesFilter(bookmark, filter)) return false;
      if (tag === UNTAGGED_FILTER && bookmark.tags.length > 0) return false;
      if (
        tag !== "all" &&
        tag !== UNTAGGED_FILTER &&
        !bookmark.tags.includes(tag)
      )
        return false;
      if (cutoff && savedTime(bookmark) < cutoff) return false;
      if (!needle) return true;
      return [
        bookmark.text,
        bookmark.caption,
        bookmark.author.displayName,
        bookmark.author.username,
        bookmark.contentType,
        ...bookmark.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
    return filtered.sort((left, right) => {
      if (sort === "saved-oldest") {
        return savedTime(left) - savedTime(right);
      }
      if (sort === "published-newest") {
        return compareOptionalDates(
          left.publishedAt,
          right.publishedAt,
          "newest",
        );
      }
      if (sort === "published-oldest") {
        return compareOptionalDates(
          left.publishedAt,
          right.publishedAt,
          "oldest",
        );
      }
      if (sort === "author-az") {
        return (left.author.displayName ?? left.author.username).localeCompare(
          right.author.displayName ?? right.author.username,
        );
      }
      return savedTime(right) - savedTime(left);
    });
  }, [bookmarks, filter, period, query, sort, tag]);

  const rendered = visible.slice(0, renderLimit);
  const selectedBookmarks = useMemo(
    () => bookmarks.filter((bookmark) => selectedIds.has(bookmark.id)),
    [bookmarks, selectedIds],
  );
  const selectionMode = selectedIds.size > 0;
  const selectedAreArchived =
    selectedBookmarks.length > 0 &&
    selectedBookmarks.every((bookmark) => bookmark.archived);

  useEffect(() => {
    setRenderLimit(INITIAL_RENDER_COUNT);
  }, [filter, period, query, sort, tag, view]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || renderLimit >= visible.length) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setRenderLimit((current) =>
          Math.min(current + RENDER_BATCH_SIZE, visible.length),
        );
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [renderLimit, visible.length]);

  const hasRefinements =
    query.trim() !== "" || period !== "anytime" || tag !== "all";

  const counts = useMemo(
    () => ({
      all: bookmarks.filter((item) => !item.archived).length,
      x: bookmarks.filter((item) => item.source === "x" && !item.archived)
        .length,
      instagram: bookmarks.filter(
        (item) => item.source === "instagram" && !item.archived,
      ).length,
      images: bookmarks.filter(
        (item) => item.contentType === "image" && !item.archived,
      ).length,
      videos: bookmarks.filter(
        (item) => item.contentType === "video" && !item.archived,
      ).length,
      carousels: bookmarks.filter(
        (item) => item.contentType === "carousel" && !item.archived,
      ).length,
      reels: bookmarks.filter(
        (item) => item.contentType === "reel" && !item.archived,
      ).length,
      text: bookmarks.filter(
        (item) =>
          ["text", "thread", "quote"].includes(item.contentType) &&
          !item.archived,
      ).length,
      archived: bookmarks.filter((item) => item.archived).length,
    }),
    [bookmarks],
  );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <BookmarksIcon size={19} weight="fill" />
          </span>
          <span className="brand-copy">
            <strong>SaveMarks</strong>
            <small>local archive</small>
          </span>
        </div>
        <nav className="sidebar-nav" aria-label="Library navigation">
          <div className="sidebar-section">
            <p>Workspace</p>
            {(
              [
                ["all", BookmarksIcon],
                ["archived", ArchiveIcon],
              ] as const
            ).map(([value, Icon]) => (
              <button
                key={value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
                aria-current={filter === value ? "page" : undefined}
                aria-label={filterLabels[value]}
                title={filterLabels[value]}
              >
                <Icon size={16} />
                <span>{filterLabels[value]}</span>
                <em>{counts[value]}</em>
              </button>
            ))}
          </div>
          <div className="sidebar-section">
            <p>Sources</p>
            <a href="/web" aria-label="Web">
              <LinkIcon size={16} />
              <span>Web</span>
              <em>{initialReadLaterCount}</em>
            </a>
            {(
              [
                ["x", XLogoIcon],
                ["instagram", InstagramLogoIcon],
              ] as const
            ).map(([value, Icon]) => (
              <button
                key={value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
                aria-current={filter === value ? "page" : undefined}
                aria-label={filterLabels[value]}
                title={filterLabels[value]}
              >
                <Icon size={16} />
                <span>{filterLabels[value]}</span>
                <em>{counts[value]}</em>
              </button>
            ))}
          </div>
          <div className="sidebar-section">
            <p>Formats</p>
            {(
              [
                ["images", ImageIcon],
                ["videos", VideoCameraIcon],
                ["carousels", GridFourIcon],
                ["reels", VideoCameraIcon],
                ["text", TextTIcon],
              ] as const
            ).map(([value, Icon]) => (
              <button
                key={value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
                aria-current={filter === value ? "page" : undefined}
                aria-label={filterLabels[value]}
                title={filterLabels[value]}
              >
                <Icon size={16} />
                <span>{filterLabels[value]}</span>
                <em>{counts[value]}</em>
              </button>
            ))}
          </div>
          <div className="sidebar-section">
            <p>Filters</p>
            <button
              className={tag === UNTAGGED_FILTER ? "active" : ""}
              onClick={() =>
                setTag((current) =>
                  current === UNTAGGED_FILTER ? "all" : UNTAGGED_FILTER,
                )
              }
              aria-pressed={tag === UNTAGGED_FILTER}
              aria-label="Bookmarks without tags"
              title="Bookmarks without tags"
            >
              <HashIcon size={16} />
              <span>Without tags</span>
              <em>{untaggedCount}</em>
            </button>
          </div>
          <div className="sidebar-section sidebar-tags">
            <p className="sidebar-section-title">
              <span>Tags</span>
              <em>{tagFacets.length}</em>
            </p>
            {tagFacets.length > 0 ? (
              tagFacets.map((facet) => (
                <button
                  key={facet.name}
                  className={tag === facet.name ? "active" : ""}
                  onClick={() =>
                    setTag((current) =>
                      current === facet.name ? "all" : facet.name,
                    )
                  }
                  aria-pressed={tag === facet.name}
                  aria-label={`Filter by tag ${facet.name}`}
                  title={`#${facet.name}`}
                >
                  <HashIcon size={15} />
                  <span>{facet.name}</span>
                  <em>{facet.count}</em>
                </button>
              ))
            ) : (
              <span className="sidebar-empty">No tags yet</span>
            )}
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-note">
            <span className="status-dot" />
            <div>
              <strong>System online</strong>
              <span>PostgreSQL / local media</span>
            </div>
          </div>
          <button className="pair-link" onClick={() => setPairing(true)}>
            <LinkIcon size={15} />
            Pair extension
            <span>↗</span>
          </button>
        </div>
      </aside>

      <section className="library">
        <div className="workspace-bar">
          <div className="mobile-brand" aria-label="SaveMarks">
            <span className="brand-mark">
              <BookmarksIcon size={18} weight="fill" />
            </span>
            <strong>SaveMarks</strong>
          </div>
          <div className="workspace-path" aria-label="Current location">
            <span>~/savemarks</span>
            <strong>/{filter}</strong>
          </div>
          <div className="workspace-tools">
            <div className="theme-toggle" role="group" aria-label="Theme">
              {(
                [
                  ["system", MonitorIcon, "Automatic theme"],
                  ["light", SunIcon, "Light theme"],
                  ["dark", MoonIcon, "Dark theme"],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  className={themePreference === value ? "active" : ""}
                  aria-label={label}
                  aria-pressed={themePreference === value}
                  title={label}
                  onClick={() => setThemePreference(value)}
                >
                  <Icon
                    size={13}
                    weight={themePreference === value ? "fill" : "regular"}
                  />
                </button>
              ))}
            </div>
            <div className="workspace-status">
              <span className="status-dot" />
              local-first
            </div>
          </div>
        </div>
        <header className="library-header">
          <div className="library-title">
            <p className="eyebrow">
              Collection /{" "}
              {String(Object.keys(counts).indexOf(filter) + 1).padStart(2, "0")}
            </p>
            <h1>{filterLabels[filter]}</h1>
            <p className="result-count">
              {visible.length} visible · {counts[filter]} indexed
            </p>
          </div>
          <div className="header-metrics" aria-label="Library metrics">
            <div>
              <span>Records</span>
              <strong>{counts.all}</strong>
            </div>
            <div>
              <span>Media</span>
              <strong>
                {counts.images +
                  counts.videos +
                  counts.carousels +
                  counts.reels}
              </strong>
            </div>
            <div>
              <span>Tags</span>
              <strong>{allTags.length}</strong>
            </div>
          </div>
        </header>

        <div className="command-row">
          <div className="header-actions">
            <label className="search">
              <MagnifyingGlassIcon size={19} />
              <input
                ref={searchInputRef}
                aria-label="Search bookmarks"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search archive…"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search">
                  <XIcon size={15} />
                </button>
              )}
              {!query && <kbd>⌘ K</kbd>}
            </label>
            <div className="view-toggle">
              <button
                className={view === "grid" ? "active" : ""}
                onClick={() => setView("grid")}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
              >
                <GridFourIcon size={18} />
              </button>
              <button
                className={view === "list" ? "active" : ""}
                onClick={() => setView("list")}
                aria-label="List view"
                aria-pressed={view === "list"}
              >
                <RowsIcon size={18} />
              </button>
            </div>
          </div>
          <button
            className="pair-link pair-link--mobile"
            onClick={() => setPairing(true)}
          >
            <LinkIcon size={15} />
            Pair
          </button>
        </div>

        <div className="explore-bar" aria-label="Library controls">
          <div className="control-group">
            <FunnelSimpleIcon size={16} />
            <label>
              <span>Sort</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
              >
                {(Object.entries(sortLabels) as [Sort, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
              <CaretDownIcon size={12} />
            </label>
            <label>
              <CalendarBlankIcon size={15} />
              <span>Added</span>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value as Period)}
              >
                {(Object.entries(periodLabels) as [Period, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
              <CaretDownIcon size={12} />
            </label>
            <label>
              <TagIcon size={15} />
              <span>Tag</span>
              <select
                value={tag}
                onChange={(event) => setTag(event.target.value)}
              >
                <option value="all">All tags</option>
                <option value={UNTAGGED_FILTER}>Without tags</option>
                {allTags.map((value) => (
                  <option key={value} value={value}>
                    #{value}
                  </option>
                ))}
              </select>
              <CaretDownIcon size={12} />
            </label>
          </div>
          {hasRefinements && (
            <button
              className="clear-filters"
              onClick={() => {
                setQuery("");
                setPeriod("anytime");
                setTag("all");
              }}
            >
              Clear filters
              <XIcon size={13} />
            </button>
          )}
        </div>

        <div className="index-line">
          <span>INDEX / {filter.toUpperCase()}</span>
          <span className="index-line-actions">
            <button
              className="index-select"
              disabled={visible.length === 0}
              onClick={() =>
                setSelectedIds(new Set(visible.map((bookmark) => bookmark.id)))
              }
            >
              Select visible
            </button>
            <span>{sortLabels[sort]}</span>
          </span>
        </div>

        {visible.length > 0 ? (
          <>
            <div className={`bookmark-grid bookmark-grid--${view}`}>
              {rendered.map((bookmark, index) => (
                <div
                  className="card-reveal"
                  style={{ animationDelay: `${Math.min(index, 18) * 24}ms` }}
                  key={bookmark.id}
                >
                  <BookmarkCard
                    bookmark={bookmark}
                    view={view}
                    sort={sort}
                    selected={selectedIds.has(bookmark.id)}
                    selectionMode={selectionMode}
                    onOpen={() => setSelected(bookmark)}
                    onToggleSelected={() => toggleSelected(bookmark.id)}
                    onArchive={() =>
                      runBulkAction({
                        action: "archive",
                        ids: [bookmark.id],
                        archived: !bookmark.archived,
                      })
                    }
                    onDelete={() => setDeleteIds(new Set([bookmark.id]))}
                    onAddTag={(nextTag) =>
                      runBulkAction({
                        action: "add_tag",
                        ids: [bookmark.id],
                        tag: nextTag,
                      })
                    }
                  />
                </div>
              ))}
            </div>
            {rendered.length < visible.length && (
              <div className="load-more" ref={loadMoreRef}>
                <button
                  onClick={() =>
                    setRenderLimit((current) =>
                      Math.min(current + RENDER_BATCH_SIZE, visible.length),
                    )
                  }
                >
                  Load more
                  <span>
                    {rendered.length} / {visible.length}
                  </span>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <MagnifyingGlassIcon size={28} />
            <h2>No memories found</h2>
            <p>Try another search or library filter.</p>
          </div>
        )}
      </section>

      {selectionMode && (
        <aside className="bulk-toolbar" aria-label="Bulk bookmark actions">
          <div className="bulk-count">
            <span>{selectedIds.size}</span>
            <div>
              <strong>Selected</strong>
              <small>
                {selectedIds.size === visible.length
                  ? "All visible"
                  : "Custom selection"}
              </small>
            </div>
          </div>
          <form
            className="bulk-tag"
            onSubmit={(event) => {
              event.preventDefault();
              const value = bulkTag
                .trim()
                .replace(/^#/, "")
                .toLocaleLowerCase();
              if (!value) return;
              void runBulkAction({
                action: "add_tag",
                ids: [...selectedIds],
                tag: value,
              });
            }}
          >
            <TagIcon size={16} />
            <input
              value={bulkTag}
              disabled={bulkBusy}
              maxLength={50}
              placeholder="Add tag to selection"
              aria-label="Tag for selected bookmarks"
              onChange={(event) => setBulkTag(event.target.value)}
            />
            <button disabled={!bulkTag.trim() || bulkBusy}>Add</button>
          </form>
          <div className="bulk-actions">
            <button
              disabled={bulkBusy}
              onClick={() =>
                void runBulkAction({
                  action: "archive",
                  ids: [...selectedIds],
                  archived: !selectedAreArchived,
                })
              }
            >
              <ArchiveIcon size={16} />
              {selectedAreArchived ? "Restore" : "Archive"}
            </button>
            <button
              className="bulk-delete"
              disabled={bulkBusy}
              onClick={() => setDeleteIds(new Set(selectedIds))}
            >
              <TrashIcon size={16} />
              Delete
            </button>
            <button
              className="bulk-clear"
              disabled={bulkBusy}
              onClick={() => setSelectedIds(new Set())}
              aria-label="Clear selection"
              title="Clear selection"
            >
              <XIcon size={17} />
            </button>
          </div>
          {bulkError && <p className="bulk-error">{bulkError}</p>}
        </aside>
      )}

      <MobileDock
        active={
          filter === "x" || filter === "instagram" || filter === "archived"
            ? filter
            : "all"
        }
        onSelect={setFilter}
      />

      {selected && (
        <Detail
          bookmark={selected}
          onClose={() => setSelected(undefined)}
          onTagsChange={(nextTags) => {
            setBookmarks((items) =>
              items.map((item) =>
                item.id === selected.id ? { ...item, tags: nextTags } : item,
              ),
            );
            setSelected((item) =>
              item ? { ...item, tags: nextTags } : undefined,
            );
          }}
          onArchivedChange={(archived) => {
            setBookmarks((items) =>
              items.map((item) =>
                item.id === selected.id ? { ...item, archived } : item,
              ),
            );
            setSelected((item) => (item ? { ...item, archived } : undefined));
          }}
        />
      )}
      {pairing && <PairingDialog onClose={() => setPairing(false)} />}
      {deleteIds && (
        <DeleteDialog
          count={deleteIds.size}
          busy={bulkBusy}
          onCancel={() => setDeleteIds(undefined)}
          onConfirm={() => {
            const ids = [...deleteIds];
            void runBulkAction({ action: "delete", ids }).then((success) => {
              if (success) setDeleteIds(undefined);
            });
          }}
        />
      )}
    </main>
  );
}
