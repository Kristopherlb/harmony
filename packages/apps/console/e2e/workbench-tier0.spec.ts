import { test, expect } from "@playwright/test";

test("Tier-0: chat -> deterministic draft renders on canvas", async ({ page }) => {
  // Disable onboarding modal for deterministic E2E.
  await page.addInitScript(() => {
    window.localStorage.setItem("harmony.workbench.onboarding.v1.seen", "true");
  });

  await page.goto("/workbench");

  await expect(page.getByTestId("workbench-chat-panel")).toBeVisible();
  await expect(page.getByTestId("workbench-empty-state")).toBeVisible();

  await page.getByTestId("workbench-chat-input").fill("Create a simple workflow with 3 steps.");
  await expect(page.getByTestId("workbench-chat-send")).toBeEnabled();
  await page.getByTestId("workbench-chat-send").click();

  // Accept proposal (pending draft) so it becomes the displayed draft and canvas mounts.
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByText("Apply agent proposal?")).toBeVisible();
  await page.getByRole("button", { name: "Apply" }).click();

  // Canvas should reflect nodes/edges counts (deterministic fixture draft has 3 nodes, 2 edges).
  await expect(page.getByTestId("workbench-drafting-canvas")).toBeVisible();
  await expect(page.getByText(/nodes:\s*3\s*edges:\s*2/i)).toBeVisible();
});

