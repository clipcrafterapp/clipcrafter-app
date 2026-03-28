import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";

/**
 * GET /api/clips/[clipId]/download
 * Proxies the R2 export file through our server with Content-Disposition: attachment
 * so mobile browsers (Safari) download instead of opening inline.
 */
export async function GET(request: Request, { params }: { params: Promise<{ clipId: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return new Response("Unauthorized", { status: 401 });

  const { clipId } = await params;

  const { data: clip, error } = await supabaseAdmin
    .from("clips")
    .select("id, export_url, clip_title, title, projects(user_id)")
    .eq("id", clipId)
    .single();

  if (error || !clip) return new Response("Not found", { status: 404 });

  type Row = typeof clip & { projects: { user_id: string } | null };
  const row = clip as Row;
  if (row.projects?.user_id !== supabaseUserId) return new Response("Forbidden", { status: 403 });
  if (!row.export_url) return new Response("Not exported yet", { status: 404 });

  // Fetch the file from R2
  const r2Res = await fetch(row.export_url);
  if (!r2Res.ok) return new Response("Failed to fetch file", { status: 502 });

  const rawTitle = row.clip_title ?? row.title ?? `clip-${clipId}`;
  const safeFilename =
    rawTitle
      .replace(/[^a-z0-9\s-]/gi, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || `clip-${clipId}`;

  return new Response(r2Res.body, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${safeFilename}.mp4"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
