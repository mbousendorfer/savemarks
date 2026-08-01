import { describe, expect, it } from "vitest";
import { extractPageMetadata } from "./read-later-enrichment";

describe("read-later metadata extraction", () => {
  it("prefers Open Graph metadata and resolves relative images", () => {
    expect(
      extractPageMetadata(
        `<html><head>
          <title>Fallback title</title>
          <meta property="og:title" content="Saved title">
          <meta property="og:description" content="A useful article">
          <meta property="og:site_name" content="Field Notes">
          <meta property="og:image" content="/cover.jpg">
          <meta name="author" content="Ada">
        </head></html>`,
        "https://example.com/posts/one",
      ),
    ).toEqual({
      title: "Saved title",
      description: "A useful article",
      siteName: "Field Notes",
      author: "Ada",
      imageUrl: "https://example.com/cover.jpg",
    });
  });

  it("falls back to the hostname without executing page scripts", () => {
    expect(
      extractPageMetadata(
        `<title>Plain page</title><script>throw new Error("must not run")</script>`,
        "https://notes.example/path",
      ),
    ).toMatchObject({ title: "Plain page", siteName: "notes.example" });
  });
});
