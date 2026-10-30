import { expect, test } from '@playwright/test';

// The links Léa saved under the French routes keep working (#65)
test.describe('French routes', () => {
  for (const { frenchPath, englishPath } of [
    { frenchPath: '/profil', englishPath: '/profile' },
    { frenchPath: '/consignes', englishPath: '/instructions' },
    { frenchPath: '/candidats', englishPath: '/candidates' },
    { frenchPath: '/candidat', englishPath: '/candidate' },
  ]) {
    test(`redirects ${frenchPath} permanently to ${englishPath}`, async ({ page }) => {
      const response = await page.request.get(`${frenchPath}?from=bookmark`, { maxRedirects: 0 });

      expect(response.status()).toBe(301);
      expect(response.headers().location).toBe(`${englishPath}?from=bookmark`);
    });
  }

  test('opens the English page from a French link', async ({ page }) => {
    await page.goto('/candidats');

    await expect(page).toHaveURL(/\/candidates$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Candidats');
  });
});
