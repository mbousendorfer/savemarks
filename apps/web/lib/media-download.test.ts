import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { streamToFile } from "./media-download";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function destination() {
  const directory = await mkdtemp(join(tmpdir(), "savemarks-media-"));
  directories.push(directory);
  return join(directory, "asset.bin");
}

describe("streamToFile", () => {
  it("streams bytes to disk while computing their digest", async () => {
    const path = await destination();
    const response = new Response(new TextEncoder().encode("hello"));

    await expect(streamToFile(response, path, 32)).resolves.toEqual({
      hash: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      size: 5,
    });
    await expect(readFile(path, "utf8")).resolves.toBe("hello");
  });

  it("removes partial files when the limit is exceeded", async () => {
    const path = await destination();
    const response = new Response(new Uint8Array(64));

    await expect(streamToFile(response, path, 16)).rejects.toThrow(
      "Media exceeds",
    );
    await expect(access(path)).rejects.toThrow();
  });
});
