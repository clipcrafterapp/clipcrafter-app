import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ClipListView } from "../ClipListView";
import type { Clip } from "../types";

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: "clip_1",
    project_id: "proj_1",
    title: "Test Clip",
    clip_title: "Test Clip Title",
    start_sec: 10,
    end_sec: 40,
    score: 85,
    score_reason: "High impact",
    hashtags: ["#test"],
    status: "pending",
    caption_style: "hormozi" as const,
    aspect_ratio: "9:16" as const,
    topic: "motivation",
    export_url: null,
    ...overrides,
  };
}

const noop = () => {};

function makeProps(overrides: Partial<Parameters<typeof ClipListView>[0]> = {}) {
  return {
    sortedClips: [makeClip()],
    selectedClipId: null,
    selectedClipIds: new Set<string>(),
    selectedTopic: null,
    clipsStatus: "idle",
    clips: [makeClip()],
    withCaptions: false,
    onSetSelectedTopic: noop,
    onSetSelectedClipId: vi.fn(),
    onSeekToClip: vi.fn(),
    onToggleClipCheck: noop,
    onSelectAll: noop,
    onDeselectAll: noop,
    onToggleCaptions: noop,
    onExportBatch: noop,
    onClipAction: vi.fn(),
    onExportClip: vi.fn(),
    onGenerateClips: noop,
    ...overrides,
  };
}

describe("ClipListView", () => {
  it("renders a list of clips", () => {
    render(<ClipListView {...makeProps()} />);
    expect(screen.getByText("Test Clip Title")).toBeInTheDocument();
  });

  it("shows the score badge for each clip", () => {
    render(<ClipListView {...makeProps()} />);
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("shows formatted time range for each clip", () => {
    render(<ClipListView {...makeProps()} />);
    // 10s = 0:10, 40s = 0:40
    expect(screen.getByText(/0:10/)).toBeInTheDocument();
  });

  it("calls onSetSelectedClipId when a clip is clicked", () => {
    const mockSelect = vi.fn();
    render(<ClipListView {...makeProps({ onSetSelectedClipId: mockSelect })} />);
    fireEvent.click(screen.getByText("Test Clip Title"));
    expect(mockSelect).toHaveBeenCalledWith("clip_1");
  });

  it("shows score as dash when score is 0", () => {
    render(<ClipListView {...makeProps({ sortedClips: [makeClip({ score: 0 })] })} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
