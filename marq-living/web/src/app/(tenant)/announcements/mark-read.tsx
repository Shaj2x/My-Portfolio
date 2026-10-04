"use client";

import { useEffect } from "react";
import { markAnnouncementsRead } from "@/lib/actions/announcements";

// Viewing the list counts as reading what's on it.
export function MarkRead({ ids }: { ids: string[] }) {
  useEffect(() => {
    if (ids.length) markAnnouncementsRead(ids);
  }, [ids]);
  return null;
}
