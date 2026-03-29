import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * GET /api/clips/[clipId]/download
 * Returns a fresh presigned R2 URL (redirect) so the browser can download the clip.
 * Re-signs the URL on every request to avoid stale presigned URL errors (7-day expiry).
 */

type ClipDownloadRow = {
  id: string;
  export_url: string | null;
  clip_title: string | null;
  title: string | null;
  projects: { user_id: string } | null;
};

function buildFilename(raw: string, clipId: string): string {
  return (
    raw
      .replace(/[^a-z0-9\s-]/gi, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || `clip-${clipId}`
  );
}

/**
 * Extract the R2 object key from a presigned URL.
 * Presigned URL format: https://<accountId>.r2.cloudflarestorage.com/<bucket>/<key>?X-Amz-...
 * or via public domain. We extract the path after the bucket name.
 */
function extractR2Key(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    // pathname = /<bucket>/<key...> → skip bucket name (first segment)
    if (parts.length < 2) return null;
    return parts.slice(1).join("/");
  } catch {
    return null;
  }
}

async function resolveClip(clipId: string): Promise<ClipDownloadRow | null> {
  const { data, error } = await supabaseAdmin
    .from("clips")
    .select("id, export_url, clip_title, title, projects(user_id)")
    .eq("id", clipId)
    .single();
  if (error || !data) return null;
  return data as unknown as ClipDownloadRow;
}

export async function GET(_request: Request, { params }: { params: Promise<{ clipId: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return new Response("Unauthorized", { status: 401 });

  const { clipId } = await params;
  const clip = await resolveClip(clipId);

  if (!clip) return new Response("Not found", { status: 404 });
  if (clip.projects?.user_id !== supabaseUserId) return new Response("Forbidden", { status: 403 });
  if (!clip.export_url) return new Response("Not exported yet", { status: 404 });

  const filename = buildFilename(clip.clip_title ?? clip.title ?? `clip-${clipId}`, clipId);

  // Try to re-sign via R2 key (avoids stale presigned URL)
  const r2Key = extractR2Key(clip.export_url);
  if (r2Key) {
    try {
      const freshUrl = await getSignedUrl(
        r2Client,
        new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
          ResponseContentDisposition: `attachment; filename="${filename}.mp4"`,
        }),
        { expiresIn: 3600 }
      );
      return Response.redirect(freshUrl, 302);
    } catch {
      // Fall through to direct fetch if re-sign fails
    }
  }

  // Fallback: proxy through server (handles edge cases)
  const r2Res = await fetch(clip.export_url);
  if (!r2Res.ok) {
    return new Response("Export file unavailable — please re-export this clip", { status: 410 });
  }

  return new Response(r2Res.body, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}.mp4"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
