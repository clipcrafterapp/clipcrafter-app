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

import React, { useCallback, useEffect, useRef } from "react";
import {
  TimelineProvider,
  useTimelineContext,
  TIMELINE_ELEMENT_TYPE,
  TRACK_TYPES,
  type TrackElement,
  type ProjectJSON,
  type TimelineEditor,
} from "@twick/timeline";
import { Clip } from "./types";

// ── constants ─────────────────────────────────────────────────────────────────

const CLIPS_TRACK_ID = "clips-track";

// ── helpers ───────────────────────────────────────────────────────────────────

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

function applyTwick(editor: TimelineEditor, clipId: string, ns: number, ne: number) {
  const data = editor.getTimelineData();
  const track = data?.tracks.find((t) => t.getId() === CLIPS_TRACK_ID);
  const el = track?.getElementById(clipId);
  if (el) editor.trimElement(el as TrackElement, ns, ne);
}

function clampPatch(clip: Clip | undefined, side: "start" | "end", dv: number) {
  if (!clip) return dv;
  return side === "start" ? Math.min(dv, clip.end_sec - 0.5) : Math.max(dv, clip.start_sec + 0.5);
}

// ── props ─────────────────────────────────────────────────────────────────────

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

// ── drag handler hook ─────────────────────────────────────────────────────────

interface DragHookConfig {
  timelineRef: React.RefObject<HTMLDivElement | null>;
  clipsMapRef: React.MutableRefObject<Map<string, Clip>>;
  editor: TimelineEditor;
  duration: number;
  onSeek: (s: number) => void;
  onClipTrimmed: TwickTimelineProps["onClipTrimmed"];
}

function useDragHandler(cfg: DragHookConfig) {
  const { timelineRef, clipsMapRef, editor, duration, onSeek, onClipTrimmed } = cfg;
  return useCallback(
    (e: React.MouseEvent, clipId: string, side: "start" | "end") => {
      e.stopPropagation();
      e.preventDefault();
      const init = clipsMapRef.current.get(clipId);
      let dv = init ? (side === "start" ? init.start_sec : init.end_sec) : 0;
      let lastMs = 0;
      const onMove = (ev: MouseEvent) => {
        const rect = timelineRef.current?.getBoundingClientRect();
        if (!rect || duration === 0) return;
        dv = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)) * duration;
        const now = Date.now();
        if (now - lastMs >= 100) {
          onSeek(dv);
          lastMs = now;
        }
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onTm);
        window.removeEventListener("touchend", onTe);
        const clip = clipsMapRef.current.get(clipId);
        const pv = clampPatch(clip, side, dv);
        const ns = side === "start" ? pv : (clip?.start_sec ?? 0);
        const ne = side === "end" ? pv : (clip?.end_sec ?? duration);
        applyTwick(editor, clipId, ns, ne);
        onClipTrimmed?.(clipId, ns, ne);
      };
      const onTm = (ev: TouchEvent) => {
        ev.preventDefault();
        onMove({ clientX: ev.touches[0].clientX } as MouseEvent);
      };
      const onTe = () => onUp();
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onTm, { passive: false });
      window.addEventListener("touchend", onTe);
    },
    [clipsMapRef, timelineRef, editor, duration, onSeek, onClipTrimmed]
  );
}

// ── ClipBar sub-component ─────────────────────────────────────────────────────

function ClipBar({
  clip,
  duration,
  selectedClipIds,
  selectedTopic,
  onClipClick,
  onHandleMouseDown,
}: {
  clip: Clip;
  duration: number;
  selectedClipIds: Set<string>;
  selectedTopic: string | null;
  onClipClick?: (id: string) => void;
  onHandleMouseDown: (e: React.MouseEvent, id: string, side: "start" | "end") => void;
}) {
  const left = (clip.start_sec / duration) * 100;
  const width = ((clip.end_sec - clip.start_sec) / duration) * 100;
  const isSel = selectedClipIds.has(clip.id);
  const isInFilter = !selectedTopic || clip.topic === selectedTopic;
  const isChecked = selectedClipIds.has(clip.id);
  let dimClass = "";
  if (!isInFilter) dimClass = "opacity-30";
  else if (!isChecked && selectedClipIds.size > 0) dimClass = "opacity-60";

  function makeTouch(ev: React.TouchEvent, side: "start" | "end") {
    ev.stopPropagation();
    onHandleMouseDown(
      {
        clientX: ev.touches[0].clientX,
        stopPropagation: () => {},
        preventDefault: () => {},
      } as unknown as React.MouseEvent,
      clip.id,
      side
    );
  }

  return (
    <div
      className={`absolute top-2 bottom-2 rounded ${clipBarColor(clip, isSel)} ${isSel ? "z-10" : "z-0"} ${dimClass}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      onClick={(ev) => {
        ev.stopPropagation();
        onClipClick?.(clip.id);
      }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-6 cursor-ew-resize flex items-center justify-center touch-none"
        onMouseDown={(ev) => onHandleMouseDown(ev, clip.id, "start")}
        onTouchStart={(ev) => makeTouch(ev, "start")}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="w-1.5 h-8 bg-white/80 rounded-full" />
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-6 cursor-ew-resize flex items-center justify-center touch-none"
        onMouseDown={(ev) => onHandleMouseDown(ev, clip.id, "end")}
        onTouchStart={(ev) => makeTouch(ev, "end")}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="w-1.5 h-8 bg-white/80 rounded-full" />
      </div>
    </div>
  );
}

// ── inner component (needs TimelineProvider ancestor) ─────────────────────────

function TimelineContent(props: TwickTimelineProps) {
  const {
    clips,
    duration,
    currentTime,
    selectedClipIds,
    selectedTopic,
    onSeek,
    onClipTrimmed,
    onClipClick,
  } = props;
  const { editor } = useTimelineContext();
  const timelineRef = useRef<HTMLDivElement>(null);
  const clipsMapRef = useRef<Map<string, Clip>>(new Map());

  useEffect(() => {
    clipsMapRef.current = new Map(clips.map((c) => [c.id, c]));
  }, [clips]);
  useEffect(() => {
    editor.loadProject({ tracks: buildInitialData(clips).tracks, version: 1 });
  }, [editor, clips]);

  const handleHandleMouseDown = useDragHandler({
    timelineRef,
    clipsMapRef,
    editor,
    duration,
    onSeek,
    onClipTrimmed,
  });

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!timelineRef.current || duration === 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration);
  }

  return (
    <div
      ref={timelineRef}
      className="relative h-20 bg-gray-900 border-t border-gray-800 cursor-pointer shrink-0"
      onClick={handleTimelineClick}
    >
      {duration > 0 &&
        clips.map((clip) => (
          <ClipBar
            key={clip.id}
            clip={clip}
            duration={duration}
            selectedClipIds={selectedClipIds}
            selectedTopic={selectedTopic}
            onClipClick={onClipClick}
            onHandleMouseDown={handleHandleMouseDown}
          />
        ))}
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

// ── exported default — wraps in TimelineProvider ──────────────────────────────

export default function TwickTimelineInner(props: TwickTimelineProps) {
  return (
    <TimelineProvider
      contextId="twick-clips"
      initialData={buildInitialData(props.clips)}
      analytics={{ enabled: false }}
    >
      <TimelineContent {...props} />
    </TimelineProvider>
  );
}
