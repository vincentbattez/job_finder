import { expect, test } from '@playwright/test';

// The links Léa saved under the French routes keep working (#65)
test.describe('French routes', () => {
  for (const { frenchPath, englishPath } of [
    { frenchPath: '/profil', englishPath: '/profile' },
    { frenchPath: '/consignes', englishPath: '/settings' },
    { frenchPath: '/instructions', englishPath: '/settings' },
    { frenchPath: '/candidats', englishPath: '/settings' },
    { frenchPath: '/candidates', englishPath: '/settings' },
    { frenchPath: '/veilles', englishPath: '/watches' },
    { frenchPath: '/offres/2026-2445600', englishPath: '/postings/2026-2445600' },
    // The list of every Posting went away: To Apply is what a link to it was for
    { frenchPath: '/postings', englishPath: '/to-apply' },
  ]) {
    test(`redirects ${frenchPath} permanently to ${englishPath}`, async ({ page }) => {
      const response = await page.request.get(`${frenchPath}?from=bookmark`, { maxRedirects: 0 });

      expect(response.status()).toBe(301);
      expect(response.headers().location).toBe(`${englishPath}?from=bookmark`);
    });
  }

  // Forms posted to these, never a link: no stored address needs them, and a redirect would answer nothing anyway
  for (const formPath of ['/candidat', '/offres/2026-2445600/statut', '/offres/2026-2445600/recherche/retenue']) {
    test(`no longer redirects ${formPath}`, async ({ page }) => {
      const response = await page.request.get(formPath, { maxRedirects: 0 });

      expect(response.status()).toBe(404);
    });
  }

  // A filter of the Posting list saved before its parameters spoke English keeps filtering
  test('redirects the French filters of the Posting list permanently to the English ones', async ({ page }) => {
    const response = await page.request.get('/?ville=Melun&region=%C3%8Ele-de-France&archivees=on', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe('/?city=Melun&region=%C3%8Ele-de-France&archived=on');
  });

  test('opens the English page from a French link', async ({ page }) => {
    await page.goto('/candidats');

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Réglages');
  });
});
