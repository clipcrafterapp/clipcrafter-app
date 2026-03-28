"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { PlayerSectionProps } from "./PlayerSection";

// TwickPlayerInner uses @twick/live-player which requires a browser environment
const TwickPlayerInner = dynamic(() => import("./TwickPlayerInner"), {
  ssr: false,
  loading: () => <div className="flex-1 bg-black" />,
});

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <svg
        className="w-8 h-8 text-violet-500 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
        <path strokeLinecap="round" d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
      </svg>
    </div>
  );
}

export function TwickPlayerSection({
  isCompleted,
  artifacts,
  videoUrl,
  ...rest
}: PlayerSectionProps) {
  if (!isCompleted)
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <p className="text-sm">Video player available once processing completes.</p>
      </div>
    );

  if (artifacts?.video && !artifacts.video.available)
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <p className="text-sm">No video available for this project.</p>
      </div>
    );

  if (!videoUrl) return <Spinner />;

  return <TwickPlayerInner videoUrl={videoUrl} {...rest} />;
}
