import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

type ClerkUserLike = Awaited<ReturnType<typeof currentUser>>;

function resolveEmail(clerkId: string, clerkUser: ClerkUserLike): string {
  return clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${clerkId}@noemail.local`;
}

function resolveFullName(clerkUser: ClerkUserLike): string | undefined {
  if (!clerkUser) return undefined;
  return `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || undefined;
}

async function createSupabaseUser(clerkId: string): Promise<string | null> {
  // Auto-create user — Clerk webhook may not have fired yet
  const clerkUser = await currentUser();
  const email = resolveEmail(clerkId, clerkUser);
  const full_name = resolveFullName(clerkUser);

  const { data: newUser } = await supabaseAdmin
    .from("users")
    .insert({ clerk_id: clerkId, email, full_name })
    .select("id")
    .single();

  return newUser?.id ?? null;
}

/**
 * Resolves (or creates) the Supabase user UUID for a given Clerk user ID.
 * Returns null if resolution fails.
 */
export async function getSupabaseUserId(clerkId: string): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .single();

  if (existing) return existing.id;
  return createSupabaseUser(clerkId);
}
