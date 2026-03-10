import { test, expect } from '@playwright/test';

test('load demo and interact', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#hud-stage')).toHaveText(/\d{2}/);
  const stageValue = await page.locator('#hud-stage').textContent();
  await expect(stageValue).toBeTruthy();
  await page.click('#interact-btn');
  await page.waitForTimeout(400);
  await expect(page.locator('.hud')).toBeVisible();
  const world = page.locator('canvas');
  await expect(world).toBeVisible();
  await world.click({ position: { x: 120, y: 120 } });
});
