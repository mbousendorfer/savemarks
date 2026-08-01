import type {
  NormalizedBookmark,
  ReadLaterCapture,
} from "@savemarks/shared/models";
import { openDB, type DBSchema } from "idb";

interface QueueItemBase {
  id: string;
  mediaTransferState: "pending" | "server-download" | "browser-upload" | "done";
  retryCount: number;
  nextRetryAt: string;
  lastError?: string;
  createdAt: string;
}

export type QueueItem = QueueItemBase &
  (
    | { kind: "social_bookmark"; bookmark: NormalizedBookmark }
    | { kind: "read_later"; item: ReadLaterCapture }
  );

type StoredQueueItem = QueueItem | (QueueItemBase & { bookmark: NormalizedBookmark; kind?: undefined });

interface SaveMarksDatabase extends DBSchema {
  queue: {
    key: string;
    value: StoredQueueItem;
    indexes: { "by-next-retry": string };
  };
}

const db = openDB<SaveMarksDatabase>("savemarks-extension", 2, {
  upgrade(database, oldVersion) {
    if (oldVersion < 1) {
      const queue = database.createObjectStore("queue", { keyPath: "id" });
      queue.createIndex("by-next-retry", "nextRetryAt");
    }
  },
});

export async function enqueue(bookmark: NormalizedBookmark): Promise<void> {
  const now = new Date().toISOString();
  await (await db).put("queue", {
    id: crypto.randomUUID(),
    kind: "social_bookmark",
    bookmark,
    mediaTransferState: "pending",
    retryCount: 0,
    nextRetryAt: now,
    createdAt: now,
  });
}

export async function enqueueReadLater(item: ReadLaterCapture): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await (await db).put("queue", {
    id,
    kind: "read_later",
    item,
    mediaTransferState: "pending",
    retryCount: 0,
    nextRetryAt: now,
    createdAt: now,
  });
  return id;
}

export async function queueStats() {
  const items = await (await db).getAll("queue");
  return {
    pending: items.filter((item) => !item.lastError).length,
    failed: items.filter((item) => item.lastError).length,
  };
}

export async function flushQueue(
  serverUrl: string,
  apiToken: string,
): Promise<number> {
  const database = await db;
  const due = await database.getAllFromIndex(
    "queue",
    "by-next-retry",
    IDBKeyRange.upperBound(new Date().toISOString()),
    25,
  );
  for (const item of due) {
    try {
      const isReadLater = item.kind === "read_later";
      const response = await fetch(`${serverUrl.replace(/\/$/, "")}${isReadLater ? "/api/read-later" : "/api/bookmarks"}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          clientItemId: item.id,
          ...(isReadLater
            ? { mode: "save", item: item.item }
            : { bookmark: item.bookmark }),
        }),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error("PAIRING_REQUIRED");
      }
      if (response.status === 429) throw new Error("RATE_LIMITED");
      if (!response.ok) throw new Error(`SERVER_${response.status}`);
      await database.delete("queue", item.id);
    } catch (error) {
      const retryCount = item.retryCount + 1;
      const delay = Math.min(6 * 60 * 60_000, 15_000 * 2 ** retryCount);
      await database.put("queue", {
        ...item,
        retryCount,
        nextRetryAt: new Date(Date.now() + delay).toISOString(),
        lastError: error instanceof Error ? error.message : "UNKNOWN",
      });
      if (
        error instanceof Error &&
        ["PAIRING_REQUIRED", "RATE_LIMITED"].includes(error.message)
      ) {
        break;
      }
    }
  }
  return due.length;
}
