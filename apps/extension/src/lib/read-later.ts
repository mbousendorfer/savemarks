import {
  readLaterCaptureSchema,
  type ReadLaterCapture,
} from "@savemarks/shared/models";

export interface PagePreview {
  supported: boolean;
  url?: string | undefined;
  title?: string | undefined;
  siteName?: string | undefined;
  description?: string | undefined;
  author?: string | undefined;
  imageUrl?: string | undefined;
}

function extractFromPage(): PagePreview {
  const content = (selector: string) =>
    document.querySelector<HTMLMetaElement>(selector)?.content?.trim() || undefined;
  const link = (selector: string) =>
    document.querySelector<HTMLLinkElement>(selector)?.href || undefined;
  const protocol = location.protocol;
  if (protocol !== "http:" && protocol !== "https:") return { supported: false };
  const url = link('link[rel="canonical"]') ?? location.href;
  return {
    supported: true,
    url,
    title:
      content('meta[property="og:title"]') ??
      content('meta[name="twitter:title"]') ??
      (document.title.trim() || undefined),
    siteName: content('meta[property="og:site_name"]') ?? location.hostname,
    description:
      content('meta[property="og:description"]') ??
      content('meta[name="twitter:description"]') ??
      content('meta[name="description"]'),
    author: content('meta[name="author"]'),
    imageUrl:
      content('meta[property="og:image"]') ??
      content('meta[name="twitter:image"]'),
  };
}

export async function previewActiveTab(tabId?: number): Promise<PagePreview> {
  if (!tabId) return { supported: false };
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractFromPage,
    });
    return result?.result ?? { supported: false };
  } catch {
    return { supported: false };
  }
}

export function previewToCapture(
  preview: PagePreview,
  tags: string[],
): ReadLaterCapture | undefined {
  if (!preview.supported || !preview.url) return undefined;
  const parsed = readLaterCaptureSchema.safeParse({
    url: preview.url,
    metadata: {
      title: preview.title,
      siteName: preview.siteName,
      description: preview.description,
      author: preview.author,
      imageUrl: preview.imageUrl,
    },
    tags,
  });
  return parsed.success ? parsed.data : undefined;
}
