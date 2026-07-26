import { describe, expect, it } from "vitest";
import {
  captureTemplate,
  cursorPaths,
  extractCursor,
  fieldPaths,
  parseInstagramBookmarksPage,
  parseXBookmarksPage,
  sanitizeUrl,
} from "../src";

describe("extraction diagnostics", () => {
  it("ignores all hosts outside the explicit source allowlist", () => {
    expect(sanitizeUrl("https://example.com/private")).toBeNull();
    expect(sanitizeUrl("https://x.com.example.com/private")).toBeNull();
  });

  it("redacts sensitive query values", () => {
    expect(sanitizeUrl("https://x.com/path?token=secret&count=20")).toBe(
      "https://x.com/path?token=%5BREDACTED%5D&count=20",
    );
  });

  it("records field names without retaining response values", () => {
    expect(fieldPaths({ data: { page_info: { end_cursor: "private" } } })).toEqual(
      ["data", "data.page_info", "data.page_info.end_cursor"],
    );
    expect(cursorPaths({ data: { next_cursor: "private" } })).toEqual([
      "data.next_cursor",
    ]);
  });

  it("inspects every observed array shape deeply without retaining values", () => {
    const paths = fieldPaths({
      data: {
        timeline: {
          instructions: [
            {
              entries: [
                { content: { cursorType: "Bottom", value: "private-cursor" } },
                {
                  content: {
                    itemContent: {
                      tweet_results: {
                        result: {
                          rest_id: "private-id",
                          legacy: { full_text: "private text" },
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    });

    expect(paths).toContain(
      "data.timeline.instructions[].entries[].content.cursorType",
    );
    expect(paths).toContain(
      "data.timeline.instructions[].entries[].content.itemContent.tweet_results.result.legacy.full_text",
    );
    expect(JSON.stringify(paths)).not.toContain("private");
  });

  it("extracts a cursor from an observed nested response", () => {
    expect(extractCursor({ data: { page_info: { end_cursor: "cursor-2" } } })).toBe(
      "cursor-2",
    );
  });

  it("removes authentication material from captured templates", () => {
    const template = captureTemplate("instagram", {
      source: "instagram",
      url: "https://www.instagram.com/observed?session=secret",
      method: "POST",
      headers: { authorization: "Bearer private" },
      body: { variables: { cursor: null }, csrfToken: "private" },
      capturedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(template).toMatchObject({
      body: { variables: { cursor: null }, csrfToken: "[REDACTED]" },
    });
    expect(JSON.stringify(template)).not.toContain("Bearer private");
  });
});

describe("observed X bookmarks schema", () => {
  it("normalizes an observed bookmark page and its bottom cursor", () => {
    const page = parseXBookmarksPage({
      data: {
        bookmark_timeline_v2: {
          timeline: {
            instructions: [
              {
                entries: [
                  {
                    content: {
                      itemContent: {
                        tweet_results: {
                          result: {
                            rest_id: "2080991967291297884",
                            legacy: {
                              created_at: "Sat Jul 25 12:00:00 +0000 2026",
                              full_text: "Observed text",
                              extended_entities: {
                                media: [
                                  {
                                    type: "photo",
                                    media_url_https: "https://pbs.twimg.com/media/example.jpg",
                                    original_info: { width: 1600, height: 900 },
                                  },
                                ],
                              },
                            },
                            core: {
                              user_results: {
                                result: {
                                  rest_id: "42",
                                  core: {
                                    name: "Paris Paname",
                                    screen_name: "ParisAMDParis",
                                  },
                                  avatar: {
                                    image_url:
                                      "https://pbs.twimg.com/profile_images/example.jpg",
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  {
                    content: {
                      cursorType: "Bottom",
                      value: "cursor-2",
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    });

    expect(page.cursor).toBe("cursor-2");
    expect(page.items).toEqual([
      expect.objectContaining({
        source: "x",
        sourceItemId: "2080991967291297884",
        canonicalUrl:
          "https://x.com/ParisAMDParis/status/2080991967291297884",
        contentType: "image",
        text: "Observed text",
        author: expect.objectContaining({
          username: "ParisAMDParis",
          displayName: "Paris Paname",
        }),
        media: [
          expect.objectContaining({
            sourceUrl: "https://pbs.twimg.com/media/example.jpg",
            type: "image",
            width: 1600,
            height: 900,
          }),
        ],
      }),
    ]);
  });
});

describe("observed Instagram saved schema", () => {
  it("normalizes a paginated image from the saved feed", () => {
    const page = parseInstagramBookmarksPage({
      items: [
        {
          pk: "123456789",
          code: "DExample",
          media_type: 1,
          taken_at: 1_774_000_000,
          caption: { text: "Saved caption" },
          user: {
            pk: "42",
            username: "designer",
            full_name: "Product Designer",
            profile_pic_url: "https://scontent.cdninstagram.com/avatar.jpg",
          },
          image_versions2: {
            candidates: [
              {
                url: "https://scontent.cdninstagram.com/small.jpg",
                width: 320,
                height: 320,
              },
              {
                url: "https://scontent.cdninstagram.com/large.jpg",
                width: 1080,
                height: 1350,
              },
            ],
          },
        },
      ],
      more_available: true,
      next_max_id: "next-page",
    });

    expect(page.cursor).toBe("next-page");
    expect(page.items).toEqual([
      expect.objectContaining({
        source: "instagram",
        sourceItemId: "123456789",
        canonicalUrl: "https://www.instagram.com/p/DExample/",
        contentType: "image",
        caption: "Saved caption",
        author: expect.objectContaining({
          username: "designer",
          displayName: "Product Designer",
        }),
        media: [
          expect.objectContaining({
            sourceUrl: "https://scontent.cdninstagram.com/large.jpg",
            type: "image",
            width: 1080,
            height: 1350,
          }),
        ],
      }),
    ]);
  });

  it("normalizes a reel and keeps its local-download candidates", () => {
    const page = parseInstagramBookmarksPage({
      data: {
        xdt_api__v1__feed__saved__posts: {
          items: [
            {
              pk: "987654321",
              code: "DReel",
              media_type: 2,
              product_type: "clips",
              user: { pk: "7", username: "motion" },
              video_versions: [
                {
                  url: "https://scontent.cdninstagram.com/reel.mp4",
                  width: 1080,
                  height: 1920,
                },
              ],
              image_versions2: {
                candidates: [
                  {
                    url: "https://scontent.cdninstagram.com/reel.jpg",
                    width: 1080,
                    height: 1920,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    expect(page.items[0]).toMatchObject({
      canonicalUrl: "https://www.instagram.com/reel/DReel/",
      contentType: "reel",
      media: [
        { type: "video", mimeType: "video/mp4" },
        { type: "thumbnail", mimeType: "image/jpeg" },
      ],
    });
  });
});
