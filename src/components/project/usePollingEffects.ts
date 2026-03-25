"use client";

import { useEffect } from "react";
import { StatusData, Clip, TERMINAL_STATUSES } from "./types";

interface StatusPollingArgs {
  data: StatusData | null;
  fetchStatus: () => void;
}

export function useStatusPolling({ data, fetchStatus }: StatusPollingArgs) {
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);
  useEffect(() => {
    if (!data || TERMINAL_STATUSES.includes(data.status)) return;
    const t = setInterval(fetchStatus, 3000);
    return () => clearInterval(t);
  }, [data, fetchStatus]);
}

interface ClipsPollingArgs {
  dataStatus: string | undefined;
  clips: Clip[] | null;
  id: string;
  clipsStatus: string;
  fetchClips: () => Promise<string | undefined>;
  setClipsStatus: React.Dispatch<React.SetStateAction<string>>;
}

export function useClipsPolling({
  dataStatus,
  clips,
  id,
  clipsStatus,
  fetchClips,
  setClipsStatus,
}: ClipsPollingArgs) {
  useEffect(() => {
    if (dataStatus !== "completed" || clips !== null || clipsStatus !== "idle") return;
    fetchClips().then(async (status) => {
      if (status === "idle" || !status) {
        await fetch(`/api/projects/${id}/clips`, { method: "POST" });
        setClipsStatus("generating");
      }
    });
  }, [dataStatus, clips, id, clipsStatus, fetchClips, setClipsStatus]);

  useEffect(() => {
    if (clipsStatus !== "generating") return;
    const t = setInterval(async () => {
      const status = await fetchClips();
      if (status !== "generating") clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [clipsStatus, fetchClips]);
}

export function useAutoSelectClips(
  clips: Clip[] | null,
  setSelectedClipIds: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  useEffect(() => {
    if (clips && clips.length > 0) setSelectedClipIds(new Set(clips.map((c) => c.id)));
  }, [clips, setSelectedClipIds]);
}
