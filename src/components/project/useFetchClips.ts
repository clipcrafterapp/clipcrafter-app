"use client";

import { useCallback } from "react";
import { Clip } from "./types";

interface FetchClipsArgs {
  id: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setClips: React.Dispatch<React.SetStateAction<Clip[] | null>>;
  setClipsStatus: React.Dispatch<React.SetStateAction<string>>;
  selectedClipIdRef: React.RefObject<string | null>;
  setSelectedClipId: (id: string | null) => void;
}

export function useFetchClips(args: FetchClipsArgs) {
  const { id, videoRef, setClips, setClipsStatus, selectedClipIdRef, setSelectedClipId } = args;
  return useCallback(async () => {
    const r = await fetch(`/api/projects/${id}/clips`);
    if (!r.ok) return;
    const d = await r.json();
    const status = d.clips_status ?? "idle";
    setClipsStatus(status);
    if (d.clips && d.clips.length > 0) {
      const sorted = [...d.clips].sort((a: Clip, b: Clip) => b.score - a.score);
      setClips(sorted);
      if (!selectedClipIdRef.current) {
        setSelectedClipId(sorted[0].id);
        if (videoRef.current) videoRef.current.currentTime = sorted[0].start_sec;
      }
    }
    return status;
  }, [id, videoRef, setClips, setClipsStatus, selectedClipIdRef, setSelectedClipId]);
}
