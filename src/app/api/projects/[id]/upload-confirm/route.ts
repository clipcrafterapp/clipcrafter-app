import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";
import { captureServerError } from "@/lib/posthog-server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return Response.json({ error: "Failed to resolve user" }, { status: 500 });

  const { id } = await params;
  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (error || !project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (project.user_id !== supabaseUserId)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { key } = await request.json();
  if (!key || typeof key !== "string")
    return Response.json({ error: "key is required" }, { status: 400 });

  const { error: updateError } = await supabaseAdmin
    .from("projects")
    .update({ r2_key: key })
    .eq("id", id);

  if (updateError) {
    await captureServerError(updateError, {
      userId,
      supabaseUserId,
      route: "upload-confirm",
      projectId: id,
    });
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
