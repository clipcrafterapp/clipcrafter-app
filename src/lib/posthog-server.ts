import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

export function getPostHogServer(): PostHog | null {
  if (!process.env.POSTHOG_API_KEY) return null;
  if (!_client) {
    _client = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

export async function captureServerError(
  error: unknown,
  context: Record<string, unknown> = {}
): Promise<void> {
  const client = getPostHogServer();
  if (!client) return;
  const err = error instanceof Error ? error : new Error(String(error));
  client.capture({
    distinctId: (context.userId as string) ?? "server",
    event: "$exception",
    properties: {
      $exception_message: err.message,
      $exception_type: err.name,
      $exception_stack_trace_raw: err.stack,
      ...context,
    },
  });
  await client.shutdown();
}
