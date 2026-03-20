import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { processVideo } from "@/inngest/functions/process-video";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processVideo],
});
