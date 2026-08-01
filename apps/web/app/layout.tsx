import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaveMarks",
  description: "Your private, local-first saved-post library",
};

const themeScript = `
  try {
    var preference = localStorage.getItem("savemarks-theme");
    var resolved = preference === "light" || preference === "dark"
      ? preference
      : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = resolved;
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
