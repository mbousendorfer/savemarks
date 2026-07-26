import { createHash } from "node:crypto";
import { extname, join, normalize, relative } from "node:path";

const SAFE_MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function contentAddressedPath(hash: string, mimeType: string): string {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid SHA-256");
  const extension = SAFE_MIME_EXTENSIONS[mimeType];
  if (!extension) throw new Error("Unsupported media MIME type");
  return `${hash.slice(0, 2)}/${hash}${extension}`;
}

export function resolveMediaPath(root: string, relativePath: string): string {
  if (extname(relativePath) === "") throw new Error("Media path has no extension");
  const resolved = normalize(join(root, relativePath));
  const withinRoot = relative(root, resolved);
  if (withinRoot.startsWith("..") || withinRoot.startsWith("/")) {
    throw new Error("Media path traversal blocked");
  }
  return resolved;
}
