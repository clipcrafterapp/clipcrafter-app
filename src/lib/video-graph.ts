/**
 * VideoGraphService — Semantic graph from transcript.
 *
 * Uses callLLM() — provider-agnostic. Change LLM_PROVIDER/LLM_MODEL env vars
 * to switch between Gemini, GPT-4o, Claude, Sarvam, OpenRouter, etc.
 *
 * Output: VideoGraph JSON
 *   Nodes    = Topics the speaker covers
 *   Segments = Short-form clips within each topic (high viral potential)
 *   Edges    = Semantic flow between segments (setup→payoff, claim→proof, etc.)
 */

import { callLLM, parseLLMJson } from "@/lib/llm";
import { TranscriptSegmentInput, thinTranscript } from "@/lib/highlights";

export interface GraphNode {
  id: string;
  label: string;
  summary: string;
  importance: number;       // 0-100
  speakerId: string | null;
}

export interface GraphSegment {
  id: string;
  topicId: string;
  start: number;            // seconds
  end: number;
  hookSentence: string;     // first punchy sentence for preview
  intensityScore: number;   // 0-100 viral potential
}

export interface GraphEdge {
  source: string;           // segment id
  target: string;           // segment id
  relationshipType: "logical-flow" | "contrast" | "setup-payoff" | "claim-proof" | "problem-solution";
  emotionalArc?: string;    // e.g. "tension → release"
}

export interface VideoGraph {
  nodes: GraphNode[];
  segments: GraphSegment[];
  edges: GraphEdge[];
}

const VIDEO_GRAPH_PROMPT = (transcript: string) => `You are a Narrative Designer and viral content strategist.

Analyze this timestamped transcript and build a semantic graph of the content.

Transcript ([MM:SS] text):
${transcript}

Your task:
1. GROUP segments into "Topics" (Nodes) — distinct themes the speaker covers.
2. Within each topic, identify "Clips" (Segments) with high viral/reel potential.
   A great clip has: a strong hook, emotional punch, or delivers one clear idea in 30-90s.
3. Define "Flow" (Edges) between clips:
   - If clip A sets up a question that clip B answers → "setup-payoff"
   - If clip A makes a claim that clip B proves → "claim-proof"
   - If clip A and B present opposing views → "contrast"
   - If clip A naturally leads into clip B → "logical-flow"
   - If clip A raises a problem that clip B solves → "problem-solution"

Return ONLY valid JSON matching this exact schema (no markdown):
{
  "nodes": [
    {
      "id": "t1",
      "label": "3-5 word topic name",
      "summary": "One sentence summary of this topic",
      "importance": 85,
      "speakerId": "Speaker 0"
    }
  ],
  "segments": [
    {
      "id": "s1",
      "topicId": "t1",
      "start": "MM:SS",
      "end": "MM:SS",
      "hookSentence": "The opening sentence of this clip that hooks the viewer",
      "intensityScore": 78
    }
  ],
  "edges": [
    {
      "source": "s1",
      "target": "s2",
      "relationshipType": "setup-payoff",
      "emotionalArc": "question → answer"
    }
  ]
}

Rules:
- Use ONLY timestamps that appear in the transcript
- Each segment must be 20-120 seconds long
- intensityScore: 0-100 based on hook strength, emotional punch, quotability
- importance: 0-100 based on how central this topic is to the overall narrative
- speakerId: use the [Speaker N] tags from the transcript, or null if mixed/unclear
- Only create edges where there is a genuine semantic relationship
- Aim for 3-8 topics, 1-3 segments per topic`;

/** Parse "MM:SS" → seconds */
function parseMMSS(str: string): number {
  if (typeof str === "number") return str;
  const parts = String(str).trim().split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

export async function buildVideoGraph(
  formattedTranscript: string,
  _rawSegments?: TranscriptSegmentInput[]
): Promise<VideoGraph> {
  console.log("[video-graph] Building semantic graph...");
  const raw = await callLLM(VIDEO_GRAPH_PROMPT(thinTranscript(formattedTranscript)), {
    temperature: 0.2,
    systemPrompt: "You are a Narrative Designer. Output only valid JSON.",
  });

  const parsed = parseLLMJson<{
    nodes: Array<{ id: string; label: string; summary: string; importance: number; speakerId: string | null }>;
    segments: Array<{ id: string; topicId: string; start: string; end: string; hookSentence: string; intensityScore: number }>;
    edges: Array<{ source: string; target: string; relationshipType: GraphEdge["relationshipType"]; emotionalArc?: string }>;
  }>(raw);

  // Normalise: convert MM:SS strings → numbers on segments
  const graph: VideoGraph = {
    nodes: parsed.nodes ?? [],
    segments: (parsed.segments ?? []).map(s => ({
      ...s,
      start: parseMMSS(s.start),
      end: parseMMSS(s.end),
    })).filter(s => !isNaN(s.start) && !isNaN(s.end) && s.end > s.start),
    edges: parsed.edges ?? [],
  };

  console.log(`[video-graph] ${graph.nodes.length} topics, ${graph.segments.length} segments, ${graph.edges.length} edges`);
  return graph;
}
