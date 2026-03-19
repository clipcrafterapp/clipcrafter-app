import { test, expect } from "@playwright/test";

test.describe("Feature: Authentication", () => {
  test.describe("Scenario: User visits protected route while unauthenticated", () => {
    test("Given unauthenticated user, When they visit /dashboard, Then they are redirected to sign-in", async ({ page }) => {
      await page.goto("/dashboard");
      // Clerk will redirect to sign-in
      await expect(page).toHaveURL(/sign-in/);
    });
  });

  test.describe("Scenario: Landing page is accessible without auth", () => {
    test("Given any user, When they visit /, Then they see the landing page", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveTitle(/ToolNexus|Next.js/i);
    });
  });
});
