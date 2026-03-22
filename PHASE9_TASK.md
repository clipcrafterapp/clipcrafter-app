# Phase 9 — Director's Cut: Semantic Graph + Knowledge Graph UI

## Context
- `src/lib/video-graph.ts` exists: `buildVideoGraph(formattedTranscript, rawSegments)` → VideoGraph JSON
- `src/lib/llm.ts` exists: `callLLM(prompt, opts?)` — provider-agnostic
- `@xyflow/react` v12 is installed
- `video_graph JSONB` column added to `projects` table in Supabase
- `clips_status` and `topic_map` already on projects table

---

## Task 1 — Wire VideoGraph into Inngest pipeline

In `src/inngest/functions/generate-clips.ts`:
After `save-clips` step, add a new step `build-video-graph`:

```typescript
await step.run("build-video-graph", async () => {
  try {
    const { buildVideoGraph } = await import("@/lib/video-graph");
    const { formatSegmentsForHighlights } = await import("@/lib/highlights");
    const graph = await buildVideoGraph(
      formatSegmentsForHighlights(transcript),
      transcript
    );
    await supabaseAdmin
      .from("projects")
      .update({ video_graph: graph })
      .eq("id", projectId);
  } catch (err) {
    // Non-fatal — clips are already saved, graph is bonus
    console.warn("video graph build failed:", err);
  }
});
```

Also update GET `/api/projects/[id]/clips/route.ts` to return `video_graph` alongside `clips` and `topic_map`:
```typescript
.select("clips_status, topic_map, video_graph")
```
And return it: `video_graph: projectRes.data?.video_graph ?? null`

---

## Task 2 — VideoKnowledgeGraph React component

Create `src/components/VideoKnowledgeGraph.tsx`.

Uses `@xyflow/react` (NOT `reactflow` — that's the old package name).

```typescript
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
```

### Props:
```typescript
interface Props {
  graph: VideoGraph;                    // from video-graph.ts
  onSegmentClick: (segment: GraphSegment) => void;  // seek video to segment.start
  selectedSegmentIds: Set<string>;      // for multi-select
  onSegmentSelect: (id: string, selected: boolean) => void;
}
```

### Node rendering:
Transform `graph.nodes` (topics) into React Flow nodes:
- Position nodes in a grid layout (auto-layout: x = col*300, y = row*200)
- Node color by speakerId: Speaker 0=violet, Speaker 1=blue, Speaker 2=green, null=gray
- Node shows: topic label (bold) + summary (small gray text) + importance badge
- Node size: width=220, based on importance (more important = slightly larger)

Transform `graph.segments` into React Flow nodes too (child nodes):
- Position them near their parent topic node (below it, offset by segment index)
- Segment node shows: hookSentence (truncated) + time range + intensityScore badge
- Click handler: calls `onSegmentClick(segment)`
- Selected state: violet ring when in `selectedSegmentIds`
- Add a checkbox to each segment node

Transform `graph.edges` into React Flow edges:
- Animate edges (animated: true)
- Edge label = relationshipType formatted nicely ("setup → payoff")
- Edge color by type: logical-flow=gray, setup-payoff=violet, claim-proof=blue, contrast=orange, problem-solution=green

### Multi-select:
- Clicking a segment node toggles selection
- Show a floating "Add X to Reel" button at bottom-right when segments are selected

### Style:
- Dark background (bg-gray-950)
- ReactFlow `<Background>` with dots pattern, dark gray color
- `<Controls>` for zoom
- Compact, readable typography

---

## Task 3 — Graph View toggle on project detail page

In `src/app/dashboard/projects/[id]/page.tsx`:

Add state: `const [viewMode, setViewMode] = useState<"list" | "graph">("list")`

Add state: `const [graphSelectedIds, setGraphSelectedIds] = useState<Set<string>>(new Set())`

Above the clips section, add a view toggle:
```
[≡ List]  [⬡ Graph]
```
Small pill buttons, violet when active.

When `viewMode === "graph"`:
- Show `<VideoKnowledgeGraph>` instead of the clip cards
- Use `data?.video_graph` (fetched from the clips GET endpoint)
- `onSegmentClick`: seek video to segment.start
- `onSegmentSelect`: toggle id in graphSelectedIds
- Show "Add N segments to clips" button when graphSelectedIds.size > 0
  → POST to a new endpoint or reuse clips generation with specific timestamps

When `viewMode === "list"`:
- Show existing clip cards (unchanged)

Only show the graph toggle if `video_graph` exists on the project.

---

## Task 4 — "Add to Reel" endpoint

Create `POST /api/projects/[id]/clips/from-segments`:
```typescript
Body: { segments: Array<{ start: number; end: number; text: string; topic: string }> }
```
- Enriches each segment using callLLM (score, hashtags, title) — reuse ENRICH_PROMPT from highlights.ts
- Inserts as clips (upsert by start_sec to avoid dupes)
- Returns { clips: [...] }

---

## Principles (KISS/DRY/SOLID/YAGNI)
- Reuse `callLLM` from llm.ts — no new provider coupling
- Reuse `parseLLMJson` from llm.ts
- VideoKnowledgeGraph is purely presentational — no fetch calls inside, data flows via props
- Don't build Remotion yet (Phase 9.4) — that's next iteration

## Commit when done:
`feat(phase9): semantic graph pipeline + React Flow knowledge graph UI`

When completely done run:
openclaw system event --text "Phase 9.1+9.3 done: VideoGraph in Inngest pipeline, React Flow knowledge graph UI with multi-select" --mode now
