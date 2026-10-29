import { expect, test } from '@playwright/test';

test('says when a page does not exist', async ({ page }) => {
  await page.goto('/page-inconnue');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page introuvable');
});
