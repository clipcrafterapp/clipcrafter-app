import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase";

export const processVideo = inngest.createFunction(
  { id: "process-video" },
  { event: "video/process" },
  async ({ event, step }) => {
    const { projectId } = event.data as {
      projectId: string;
      r2Key: string;
      userId: string;
    };

    await step.run("update-status-completed", async () => {
      await supabaseAdmin
        .from("projects")
        .update({ status: "completed" })
        .eq("id", projectId);
    });

    return { projectId, status: "completed" };
  }
);
