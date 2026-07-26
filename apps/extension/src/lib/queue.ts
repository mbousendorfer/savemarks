import type { NormalizedBookmark } from "@savemarks/shared";
import { openDB, type DBSchema } from "idb";

export interface QueueItem {
  id: string;
  bookmark: NormalizedBookmark;
  mediaTransferState: "pending" | "server-download" | "browser-upload" | "done";
  retryCount: number;
  nextRetryAt: string;
  lastError?: string;
  createdAt: string;
}

interface SaveMarksDatabase extends DBSchema {
  queue: {
    key: string;
    value: QueueItem;
    indexes: { "by-next-retry": string };
  };
}

const db = openDB<SaveMarksDatabase>("savemarks-extension", 1, {
  upgrade(database) {
    const queue = database.createObjectStore("queue", { keyPath: "id" });
    queue.createIndex("by-next-retry", "nextRetryAt");
  },
});

export async function enqueue(bookmark: NormalizedBookmark): Promise<void> {
  const now = new Date().toISOString();
  await (await db).put("queue", {
    id: crypto.randomUUID(),
    bookmark,
    mediaTransferState: "pending",
    retryCount: 0,
    nextRetryAt: now,
    createdAt: now,
  });
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
      const response = await fetch(`${serverUrl.replace(/\/$/, "")}/api/bookmarks`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          clientItemId: item.id,
          bookmark: item.bookmark,
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
