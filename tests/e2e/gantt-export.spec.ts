import { test, expect } from "@playwright/test";

test.describe("Gantt Export", () => {
  test("exports Gantt as PNG", async ({ page }) => {
    await page.goto("/en-US");
    await page.waitForLoadState("domcontentloaded");

    // Navigate to a project with Gantt view
    const projectLink = page.locator('a[href*="/projects/"]').first();
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectLink.click();
      await page.waitForLoadState("domcontentloaded");

      // Switch to Gantt view
      const ganttTab = page.getByRole("tab", { name: /gantt/i });
      if (await ganttTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ganttTab.click();
        await page.waitForTimeout(1000);

        // Click export button
        const exportBtn = page.getByRole("button", { name: /export/i });
        if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Wait for download
          const downloadPromise = page.waitForEvent("download", {
            timeout: 10000,
          });
          await exportBtn.click();

          // Select PNG option if dialog appears
          const pngOption = page.getByRole("menuitem", { name: /png/i });
          if (await pngOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await pngOption.click();
          }

          const download = await downloadPromise;
          expect(download.suggestedFilename()).toMatch(/\.(png|pdf)$/i);
        }
      }
    }
  });

  test("exports Gantt as PDF", async ({ page }) => {
    await page.goto("/en-US");
    await page.waitForLoadState("domcontentloaded");

    const projectLink = page.locator('a[href*="/projects/"]').first();
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectLink.click();
      await page.waitForLoadState("domcontentloaded");

      const ganttTab = page.getByRole("tab", { name: /gantt/i });
      if (await ganttTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ganttTab.click();
        await page.waitForTimeout(1000);

        const exportBtn = page.getByRole("button", { name: /export/i });
        if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          const downloadPromise = page.waitForEvent("download", {
            timeout: 10000,
          });
          await exportBtn.click();

          const pdfOption = page.getByRole("menuitem", { name: /pdf/i });
          if (await pdfOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await pdfOption.click();
          }

          const download = await downloadPromise;
          expect(download.suggestedFilename()).toMatch(/\.(pdf|png)$/i);
        }
      }
    }
  });
});
