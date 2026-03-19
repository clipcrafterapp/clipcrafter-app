import { describe, it, expect, vi } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

// Mock supabase to avoid needing real credentials
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

Feature("Supabase User Sync", () => {
  Scenario("User record structure is valid", () => {
    it("Given a clerk user object, Then it maps to the correct DB shape", async () => {
      const clerkUser = {
        id: "user_clerk_123",
        emailAddresses: [{ emailAddress: "test@example.com" }],
        firstName: "Test",
        lastName: "User",
      };

      const { mapClerkUserToDb } = await import("@/lib/auth-sync");
      const dbUser = mapClerkUserToDb(clerkUser);

      expect(dbUser).toMatchObject({
        clerk_id: "user_clerk_123",
        email: "test@example.com",
        full_name: "Test User",
        plan: "free",
        credits: 30,
      });
    });

    it("Given a clerk user with no last name, Then full_name uses first name only", async () => {
      const clerkUser = {
        id: "user_clerk_456",
        emailAddresses: [{ emailAddress: "solo@example.com" }],
        firstName: "Solo",
        lastName: null,
      };

      const { mapClerkUserToDb } = await import("@/lib/auth-sync");
      const dbUser = mapClerkUserToDb(clerkUser);
      expect(dbUser.full_name).toBe("Solo");
    });
  });
});
