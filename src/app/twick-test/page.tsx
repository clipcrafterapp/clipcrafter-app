"use client";

/**
 * /twick-test — standalone test page for the Twick player spike.
 * No auth, no layout. Visit http://localhost:3001/twick-test to verify.
 */

import React, { useRef, useState } from "react";
import { TwickPlayerSection } from "@/components/project/TwickPlayerSection";
import type { Clip } from "@/components/project/types";

// Replace with a real presigned R2 URL or any publicly accessible MP4 to test
const TEST_VIDEO_URL =
  process.env.NEXT_PUBLIC_TEST_VIDEO_URL ??
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const MOCK_CLIPS: Clip[] = [
  {
    id: "clip-1",
    project_id: "test",
    title: "Intro",
    start_sec: 5,
    end_sec: 20,
    duration_sec: 15,
    score: 0.9,
    score_reason: null,
    status: "approved",
    caption_style: "minimal",
    aspect_ratio: "16:9",
    export_url: null,
    hashtags: [],
    clip_title: "Intro segment",
    topic: null,
  },
  {
    id: "clip-2",
    project_id: "test",
    title: "Middle",
    start_sec: 40,
    end_sec: 60,
    duration_sec: 20,
    score: 0.7,
    score_reason: null,
    status: "pending",
    caption_style: "minimal",
    aspect_ratio: "16:9",
    export_url: null,
    hashtags: [],
    clip_title: "Middle segment",
    topic: null,
  },
];

export default function TwickTestPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const selectedClip = MOCK_CLIPS.find((c) => c.id === selectedClipId) ?? null;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-4">
        <h1 className="text-lg font-semibold">Twick spike — /twick-test</h1>
        <span className="text-xs text-gray-500 font-mono truncate max-w-xs">{TEST_VIDEO_URL}</span>
      </div>

      <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
        <TwickPlayerSection
          isCompleted
          artifacts={null}
          videoUrl={TEST_VIDEO_URL}
          videoRef={videoRef}
          timelineRef={timelineRef}
          sortedClips={MOCK_CLIPS}
          selectedClipId={selectedClipId}
          clips={MOCK_CLIPS}
          duration={duration}
          currentTime={currentTime}
          isPlaying={isPlaying}
          isLooping={isLooping}
          isPreviewing={isPreviewing}
          showCaptions={showCaptions}
          captionText={showCaptions ? "Sample caption text" : null}
          selectedClip={selectedClip}
          isYouTube={false}
          youTubeVideoId={null}
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
          onSetIsPlaying={setIsPlaying}
          onTimelineClick={() => {}}
          onHandleMouseDown={() => {}}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onSkipPrev={() => setSelectedClipId(MOCK_CLIPS[0]?.id ?? null)}
          onSkipNext={() => setSelectedClipId(MOCK_CLIPS[1]?.id ?? null)}
          onToggleLoop={() => setIsLooping((l) => !l)}
          onPlayAll={() => setIsPreviewing(true)}
          onStopPreviewing={() => {
            setIsPreviewing(false);
            setIsPlaying(false);
          }}
          onToggleCaptions={() => setShowCaptions((s) => !s)}
          onSetSelectedClipId={setSelectedClipId}
          onSeekToClip={(clip) => setSelectedClipId(clip.id)}
        />
      </div>
    </div>
  );
}
