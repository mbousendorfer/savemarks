"use client";

import {
  ArchiveIcon,
  ArrowSquareOutIcon,
  BookmarksIcon,
  CheckIcon,
  CopyIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  FunnelSimpleIcon,
  GridFourIcon,
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
  VideoCameraIcon,
  XIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const INITIAL_RENDER_COUNT = 48;
const RENDER_BATCH_SIZE = 48;

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
  | "imported-newest"
  | "imported-oldest"
  | "author-az";
type Period = "anytime" | "7d" | "30d" | "90d" | "year";
type ThemePreference = "system" | "light" | "dark";

const sortLabels: Record<Sort, string> = {
  "saved-newest": "Recently saved",
  "saved-oldest": "Oldest saved",
  "published-newest": "Newest published",
  "published-oldest": "Oldest published",
  "imported-newest": "Recently synced",
  "imported-oldest": "Oldest synced",
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
  if (sort.startsWith("imported")) {
    return { label: "Synced", value: formatDate(bookmark.importedAt) };
  }
  if (bookmark.savedAt) {
    return { label: "Saved", value: formatDate(bookmark.savedAt) };
  }
  if (bookmark.publishedAt) {
    return { label: "Published", value: formatDate(bookmark.publishedAt) };
  }
  return { label: "Synced", value: formatDate(bookmark.importedAt) };
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
    <XLogoIcon size={13} weight="bold" />
  ) : (
    <InstagramLogoIcon size={14} weight="bold" />
  );
}

function Avatar({
  url,
  username,
}: {
  url: string | null;
  username: string;
}) {
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
  onOpen,
}: {
  bookmark: LibraryBookmark;
  view: View;
  sort: Sort;
  onOpen: () => void;
}) {
  const media = primaryMedia(bookmark);
  const copy = bookmark.text ?? bookmark.caption;
  const isTextual = !media;
  const date = cardDate(bookmark, sort);

  return (
    <article
      className={`bookmark-card ${isTextual ? "bookmark-card--text" : ""} ${
        view === "list" ? "bookmark-card--list" : ""
      }`}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
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
              {bookmark.author.displayName ?? `@${bookmark.author.username}`}
            </strong>
            <span>@{bookmark.author.username}</span>
          </div>
          <span className="source-mark">
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
          <span>{bookmark.contentType}</span>
        </div>
      </div>
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
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookmark-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="detail-close" onClick={onClose} aria-label="Close">
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
        <div className="detail-content">
          <div className="detail-kicker">
            <SourceMark source={bookmark.source} />
            {bookmark.source} · {bookmark.contentType}
          </div>
          <h2 id="bookmark-detail-title">
            {bookmark.author.displayName ?? `@${bookmark.author.username}`}
          </h2>
          <p className="detail-handle">@{bookmark.author.username}</p>
          {(bookmark.text ?? bookmark.caption) && (
            <p className="detail-copy">{bookmark.text ?? bookmark.caption}</p>
          )}
          <div className="tag-editor">
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
              <dt>Synced</dt>
              <dd>{formatDate(bookmark.importedAt)}</dd>
            </div>
            <div>
              <dt>Saved</dt>
              <dd>
                {bookmark.savedAt ? formatDate(bookmark.savedAt) : "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Media</dt>
              <dd>{bookmark.media.length || "None"}</dd>
            </div>
            <div>
              <dt>Source ID</dt>
              <dd>{bookmark.sourceItemId}</dd>
            </div>
          </dl>
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
    <div className="detail-backdrop" onMouseDown={onClose}>
      <section
        className="pairing-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pairing-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
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

export function Library({
  initialBookmarks,
}: {
  initialBookmarks: LibraryBookmark[];
}) {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("grid");
  const [sort, setSort] = useState<Sort>("saved-newest");
  const [period, setPeriod] = useState<Period>("anytime");
  const [tag, setTag] = useState("all");
  const [selected, setSelected] = useState<LibraryBookmark>();
  const [pairing, setPairing] = useState(false);
  const [themePreference, setThemePreference] =
    useState<ThemePreference>("system");
  const [themeReady, setThemeReady] = useState(false);
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_COUNT);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    void fetch("/api/media/sync", { method: "POST" });
    const refresh = window.setTimeout(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => window.clearTimeout(refresh);
  }, [router]);

  const allTags = useMemo(
    () => [...new Set(bookmarks.flatMap((bookmark) => bookmark.tags))].sort(),
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
      if (tag !== "all" && !bookmark.tags.includes(tag)) return false;
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
      if (sort === "imported-newest") {
        return (
          new Date(right.importedAt).getTime() -
          new Date(left.importedAt).getTime()
        );
      }
      if (sort === "imported-oldest") {
        return (
          new Date(left.importedAt).getTime() -
          new Date(right.importedAt).getTime()
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
              <strong>{counts.images + counts.videos + counts.carousels + counts.reels}</strong>
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
              <span>Saved</span>
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

        <div className="index-line" aria-hidden="true">
          <span>INDEX / {filter.toUpperCase()}</span>
          <span>{sortLabels[sort]}</span>
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
                    onOpen={() => setSelected(bookmark)}
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
    </main>
  );
}
