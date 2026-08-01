import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaveMarks",
  description: "Your private, local-first saved-post library",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeScript = `
  try {
    var preference = localStorage.getItem("savemarks-theme");
    var resolved = preference === "light" || preference === "dark"
      ? preference
      : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = resolved;
    var themeMeta = document.createElement("meta");
    themeMeta.name = "theme-color";
    themeMeta.content = resolved === "dark" ? "#0a0c0a" : "#f5f6f2";
    document.head.appendChild(themeMeta);
  } catch (_) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
