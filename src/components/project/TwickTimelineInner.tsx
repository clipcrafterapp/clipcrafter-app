/*
 * NOTE: @twick/timeline (0.15.27) is a data management library — it does NOT export
 * a visual <Timeline> React component. It provides TimelineEditor + TimelineProvider
 * for managing tracks/elements in a data model with trim, undo/redo, etc.
 *
 * This component:
 *   - Wraps clip data in Twick's data model via TimelineProvider + useTimelineContext
 *   - Syncs clips → editor via editor.loadProject() whenever the clips prop changes
 *   - Uses editor.trimElement() for trim operations (Twick feature)
 *   - Renders a custom visual scrubber (dark theme, matching existing UI)
 *   - Calls onClipTrimmed to persist trim changes via the parent's PATCH handler
 *   - Falls back to custom drag logic for trim handles (Twick has no UI layer)
 */
"use client";

import React, { useEffect, useRef } from "react";
import {
  TimelineProvider,
  useTimelineContext,
  TIMELINE_ELEMENT_TYPE,
  TRACK_TYPES,
} from "@twick/timeline";
import type { TrackElement, ProjectJSON } from "@twick/timeline";
import { Clip } from "./types";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function clipBarColor(clip: Clip, isSelected: boolean): string {
  if (clip.status === "approved") return "bg-green-600/60";
  if (clip.status === "rejected") return "bg-gray-700/40";
  return isSelected ? "bg-violet-500/70" : "bg-violet-600/50";
}

const CLIPS_TRACK_ID = "clips-track";

function buildInitialData(clips: Clip[]): ProjectJSON {
  return {
    version: 1,
    tracks: [
      {
        id: CLIPS_TRACK_ID,
        name: "Clips",
        type: TRACK_TYPES.VIDEO,
        elements: clips.map((c) => ({
          id: c.id,
          type: TIMELINE_ELEMENT_TYPE.VIDEO,
          s: c.start_sec,
          e: c.end_sec,
          t: c.clip_title ?? c.topic ?? c.id,
        })),
      },
    ],
  };
}

// ── props ────────────────────────────────────────────────────────────────────

export interface TwickTimelineProps {
  clips: Clip[];
  duration: number;
  currentTime: number;
  selectedClipIds: Set<string>;
  selectedTopic: string | null;
  onSeek: (seconds: number) => void;
  onClipTrimmed?: (clipId: string, startSec: number, endSec: number) => void;
  onClipClick?: (clipId: string) => void;
}

// ── inner component (needs TimelineProvider ancestor) ────────────────────────

function TimelineContent({
  clips,
  duration,
  currentTime,
  selectedClipIds,
  selectedTopic,
  onSeek,
  onClipTrimmed,
  onClipClick,
}: TwickTimelineProps) {
  const { editor } = useTimelineContext();
  const timelineRef = useRef<HTMLDivElement>(null);
  const clipsMapRef = useRef<Map<string, Clip>>(new Map());

  // Keep clips lookup up to date
  useEffect(() => {
    clipsMapRef.current = new Map(clips.map((c) => [c.id, c]));
  }, [clips]);

  // Reload Twick data model whenever clips change
  useEffect(() => {
    editor.loadProject({
      tracks: buildInitialData(clips).tracks,
      version: 1,
    });
  }, [editor, clips]);

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!timelineRef.current || duration === 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  }

  function handleHandleMouseDown(
    e: React.MouseEvent,
    clipId: string,
    side: "start" | "end"
  ) {
    e.stopPropagation();
    e.preventDefault();

    const clipInitial = clipsMapRef.current.get(clipId);
    let dragValue = clipInitial
      ? side === "start"
        ? clipInitial.start_sec
        : clipInitial.end_sec
      : 0;
    let lastSeekMs = 0;

    function onMouseMove(ev: MouseEvent) {
      if (!timelineRef.current || duration === 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      dragValue =
        Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)) * duration;
      const now = Date.now();
      if (now - lastSeekMs >= 100) {
        onSeek(dragValue);
        lastSeekMs = now;
      }
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);

      const clip = clipsMapRef.current.get(clipId);
      const patchValue = clip
        ? side === "start"
          ? Math.min(dragValue, clip.end_sec - 0.5)
          : Math.max(dragValue, clip.start_sec + 0.5)
        : dragValue;

      const newStart = side === "start" ? patchValue : (clip?.start_sec ?? 0);
      const newEnd = side === "end" ? patchValue : (clip?.end_sec ?? duration);

      // Trim via Twick data model
      const data = editor.getTimelineData();
      const track = data?.tracks.find((t) => t.getId() === CLIPS_TRACK_ID);
      const el = track?.getElementById(clipId);
      if (el) {
        editor.trimElement(el as TrackElement, newStart, newEnd);
      }

      onClipTrimmed?.(clipId, newStart, newEnd);
    }

    function onTouchMove(ev: TouchEvent) {
      ev.preventDefault();
      onMouseMove({ clientX: ev.touches[0].clientX } as MouseEvent);
    }

    function onTouchEnd() {
      onMouseUp();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
  }

  return (
    <div
      ref={timelineRef}
      className="relative h-20 bg-gray-900 border-t border-gray-800 cursor-pointer shrink-0"
      onClick={handleTimelineClick}
    >
      {clips &&
        duration > 0 &&
        clips.map((clip) => {
          const left = (clip.start_sec / duration) * 100;
          const width = ((clip.end_sec - clip.start_sec) / duration) * 100;
          const isSel = selectedClipIds.size > 0 && selectedClipIds.has(clip.id);
          const isInFilter = !selectedTopic || clip.topic === selectedTopic;
          const isChecked = selectedClipIds.has(clip.id);
          let dimClass = "";
          if (!isInFilter) dimClass = "opacity-30";
          else if (!isChecked && selectedClipIds.size > 0) dimClass = "opacity-60";

          return (
            <div
              key={clip.id}
              className={`absolute top-2 bottom-2 rounded ${clipBarColor(clip, isSel)} ${isSel ? "z-10" : "z-0"} ${dimClass}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={(e) => {
                e.stopPropagation();
                onClipClick?.(clip.id);
              }}
            >
              {/* Start handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-6 cursor-ew-resize flex items-center justify-center touch-none"
                onMouseDown={(e) => handleHandleMouseDown(e, clip.id, "start")}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleHandleMouseDown(
                    { clientX: e.touches[0].clientX, stopPropagation: () => {}, preventDefault: () => {} } as unknown as React.MouseEvent,
                    clip.id,
                    "start"
                  );
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-1.5 h-8 bg-white/80 rounded-full" />
              </div>
              {/* End handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-6 cursor-ew-resize flex items-center justify-center touch-none"
                onMouseDown={(e) => handleHandleMouseDown(e, clip.id, "end")}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleHandleMouseDown(
                    { clientX: e.touches[0].clientX, stopPropagation: () => {}, preventDefault: () => {} } as unknown as React.MouseEvent,
                    clip.id,
                    "end"
                  );
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-1.5 h-8 bg-white/80 rounded-full" />
              </div>
            </div>
          );
        })}
      {/* Playhead */}
      {duration > 0 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-white z-20 pointer-events-none"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
      )}
      <div className="absolute bottom-1 left-2 text-xs text-gray-600 font-mono pointer-events-none">
        {formatTime(currentTime)}
      </div>
      <div className="absolute bottom-1 right-2 text-xs text-gray-600 font-mono pointer-events-none">
        {formatTime(duration)}
      </div>
    </div>
  );
}

// ── exported default — wraps in TimelineProvider ─────────────────────────────

export default function TwickTimelineInner(props: TwickTimelineProps) {
  const initialData = buildInitialData(props.clips);
  return (
    <TimelineProvider
      contextId="twick-clips"
      initialData={initialData}
      analytics={{ enabled: false }}
    >
      <TimelineContent {...props} />
    </TimelineProvider>
  );
}
