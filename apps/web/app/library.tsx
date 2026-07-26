"use client";

import {
  ArchiveIcon,
  ArrowSquareOutIcon,
  BookmarksIcon,
  CheckIcon,
  CopyIcon,
  GridFourIcon,
  ImageIcon,
  InstagramLogoIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  RowsIcon,
  TagIcon,
  TextTIcon,
  VideoCameraIcon,
  XIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Source = "x" | "instagram";
type ContentType =
  | "text"
  | "image"
  | "video"
  | "carousel"
  | "reel"
  | "thread"
  | "quote";

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

function displayDate(bookmark: LibraryBookmark): string {
  const date = new Date(
    bookmark.savedAt ?? bookmark.publishedAt ?? bookmark.importedAt,
  );
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
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

function BookmarkCard({
  bookmark,
  view,
  onOpen,
}: {
  bookmark: LibraryBookmark;
  view: View;
  onOpen: () => void;
}) {
  const media = primaryMedia(bookmark);
  const copy = bookmark.text ?? bookmark.caption;
  const isTextual = !media;

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
          <img src={media.url} alt="" loading="lazy" referrerPolicy="no-referrer" />
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
          {bookmark.author.avatarUrl ? (
            <img
              className="avatar"
              src={bookmark.author.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="avatar avatar--fallback">
              {bookmark.author.username.slice(0, 1).toUpperCase()}
            </span>
          )}
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
          <span>{displayDate(bookmark)}</span>
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
}: {
  bookmark: LibraryBookmark;
  onClose: () => void;
  onTagsChange: (tags: string[]) => void;
}) {
  const [tagValue, setTagValue] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  const [tagError, setTagError] = useState<string>();
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  const media = primaryMedia(bookmark);

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
      setTagError(error instanceof Error ? error.message : "Could not save tags");
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

  return (
    <div className="detail-backdrop" onMouseDown={onClose}>
      <section
        className="detail-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="detail-close" onClick={onClose} aria-label="Close">
          <XIcon size={20} />
        </button>
        {media && (
          <div className="detail-media">
            <img src={media.url} alt="" referrerPolicy="no-referrer" />
          </div>
        )}
        <div className="detail-content">
          <div className="detail-kicker">
            <SourceMark source={bookmark.source} />
            {bookmark.source} · {bookmark.contentType}
          </div>
          <h2>
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
                    void saveTags(bookmark.tags.filter((value) => value !== tag))
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
                maxLength={256}
                placeholder="Add a tag…"
                onChange={(event) => setTagValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addTag();
                  }
                }}
              />
              <button disabled={!tagValue.trim() || savingTags} onClick={addTag}>
                Add
              </button>
            </div>
            {tagError && <p className="tag-error">{tagError}</p>}
          </div>
          <dl className="detail-meta">
            <div>
              <dt>Published</dt>
              <dd>{displayDate(bookmark)}</dd>
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
          <a
            className="original-link"
            href={bookmark.canonicalUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open original
            <ArrowSquareOutIcon size={17} />
          </a>
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
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="detail-close" onClick={onClose} aria-label="Close">
          <XIcon size={20} />
        </button>
        <div className="pairing-icon">
          <LinkIcon size={24} weight="bold" />
        </div>
        <p className="eyebrow">Browser connection</p>
        <h2>Pair the extension</h2>
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
  const [selected, setSelected] = useState<LibraryBookmark>();
  const [pairing, setPairing] = useState(false);

  useEffect(() => setBookmarks(initialBookmarks), [initialBookmarks]);

  useEffect(() => {
    void fetch("/api/media/sync", { method: "POST" });
    const refreshes = [5_000, 15_000, 30_000, 60_000].map((delay) =>
      window.setTimeout(() => router.refresh(), delay),
    );
    return () => refreshes.forEach((timer) => window.clearTimeout(timer));
  }, [router]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return bookmarks.filter((bookmark) => {
      if (!matchesFilter(bookmark, filter)) return false;
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
  }, [bookmarks, filter, query]);

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
            <BookmarksIcon size={22} weight="fill" />
          </span>
          <span>SaveMarks</span>
        </div>
        <div className="sidebar-section">
          <p>Library</p>
          {(
            [
              ["all", BookmarksIcon],
              ["x", XLogoIcon],
              ["instagram", InstagramLogoIcon],
              ["images", ImageIcon],
              ["videos", VideoCameraIcon],
              ["carousels", GridFourIcon],
              ["reels", VideoCameraIcon],
              ["text", TextTIcon],
              ["archived", ArchiveIcon],
            ] as const
          ).map(([value, Icon]) => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              <Icon size={17} />
              <span>{filterLabels[value]}</span>
              <em>{counts[value]}</em>
            </button>
          ))}
        </div>
        <div className="sidebar-note">
          <span className="status-dot" />
          <div>
            <strong>Local library</strong>
            <span>PostgreSQL connected</span>
          </div>
        </div>
        <button className="pair-link" onClick={() => setPairing(true)}>
          <LinkIcon size={16} />
          Pair extension
        </button>
      </aside>

      <section className="library">
        <header className="library-header">
          <div>
            <p className="eyebrow">Private archive</p>
            <h1>{filterLabels[filter]}</h1>
            <p className="result-count">
              {visible.length} saved {visible.length === 1 ? "item" : "items"}
            </p>
          </div>
          <div className="header-actions">
            <label className="search">
              <MagnifyingGlassIcon size={19} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your memory…"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search">
                  <XIcon size={15} />
                </button>
              )}
            </label>
            <div className="view-toggle">
              <button
                className={view === "grid" ? "active" : ""}
                onClick={() => setView("grid")}
                aria-label="Grid view"
              >
                <GridFourIcon size={18} />
              </button>
              <button
                className={view === "list" ? "active" : ""}
                onClick={() => setView("list")}
                aria-label="List view"
              >
                <RowsIcon size={18} />
              </button>
            </div>
          </div>
        </header>

        {visible.length > 0 ? (
          <div className={`bookmark-grid bookmark-grid--${view}`}>
            {visible.map((bookmark, index) => (
              <div
                className="card-reveal"
                style={{ animationDelay: `${Math.min(index, 18) * 24}ms` }}
                key={bookmark.id}
              >
                <BookmarkCard
                  bookmark={bookmark}
                  view={view}
                  onOpen={() => setSelected(bookmark)}
                />
              </div>
            ))}
          </div>
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
        />
      )}
      {pairing && <PairingDialog onClose={() => setPairing(false)} />}
    </main>
  );
}
