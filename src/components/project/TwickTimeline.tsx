"use client";

import dynamic from "next/dynamic";
import type { TwickTimelineProps } from "./TwickTimelineInner";

// Dynamically imported to:
//  1. Avoid SSR issues (@twick/timeline uses browser APIs)
//  2. Lazy-load the bundle (~5 MB) separately from the main chunk
const TwickTimelineInner = dynamic(() => import("./TwickTimelineInner"), {
  ssr: false,
  loading: () => (
    <div className="h-20 bg-gray-900 border-t border-gray-800 animate-pulse shrink-0" />
  ),
});

export type { TwickTimelineProps };

export function TwickTimeline(props: TwickTimelineProps) {
  return <TwickTimelineInner {...props} />;
}
