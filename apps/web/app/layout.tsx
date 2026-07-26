import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaveMarks",
  description: "Your private, local-first saved-post library",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
