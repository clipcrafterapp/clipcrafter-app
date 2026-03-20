import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, user_id, status, transcript, highlights")
    .eq("id", id)
    .single();

  if (error || !project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.user_id !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json(
    {
      id: project.id,
      status: project.status,
      transcript: project.transcript ?? null,
      highlights: project.highlights ?? null,
    },
    { status: 200 }
  );
}
