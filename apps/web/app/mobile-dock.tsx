"use client";

import {
  ArchiveIcon,
  BookmarksIcon,
  InstagramLogoIcon,
  LinkIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import Link from "next/link";

export type MobileDockItem = "all" | "x" | "instagram" | "web" | "archived";

const items = [
  ["all", "/", "All", BookmarksIcon],
  ["x", "/?source=x", "X", XLogoIcon],
  ["instagram", "/?source=instagram", "Insta", InstagramLogoIcon],
  ["web", "/web", "Web", LinkIcon],
  ["archived", "/?filter=archived", "Archive", ArchiveIcon],
] as const;

export function MobileDock({
  active,
  onSelect,
}: {
  active: MobileDockItem;
  onSelect?: (item: Exclude<MobileDockItem, "web">) => void;
}) {
  return (
    <nav className="mobile-dock" aria-label="Mobile library navigation">
      {items.map(([value, href, label, Icon]) => (
        <Link
          key={value}
          className={active === value ? "active" : ""}
          aria-current={active === value ? "page" : undefined}
          href={href}
          onClick={() => {
            if (value !== "web") onSelect?.(value);
          }}
        >
          <Icon
            size={20}
            weight={active === value && value !== "x" ? "fill" : "regular"}
          />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
