import { expect, test } from '@playwright/test';

// The links Léa saved under the French routes keep working (#65)
test.describe('French routes', () => {
  for (const { frenchPath, englishPath } of [
    { frenchPath: '/profil', englishPath: '/profile' },
    { frenchPath: '/consignes', englishPath: '/instructions' },
    { frenchPath: '/candidats', englishPath: '/settings' },
    { frenchPath: '/candidates', englishPath: '/settings' },
    { frenchPath: '/candidat', englishPath: '/candidate' },
    { frenchPath: '/offres/2026-2445600', englishPath: '/postings/2026-2445600' },
    { frenchPath: '/offres/2026-2445600/statut', englishPath: '/postings/2026-2445600/status' },
    { frenchPath: '/offres/2026-2445600/lettre/document', englishPath: '/postings/2026-2445600/letter/document' },
    {
      frenchPath: '/offres/2026-2445600/fiche_entretien/document',
      englishPath: '/postings/2026-2445600/interview_brief/document',
    },
    { frenchPath: '/offres/2026-2445600/recherche/retenue', englishPath: '/postings/2026-2445600/research/validate' },
  ]) {
    test(`redirects ${frenchPath} permanently to ${englishPath}`, async ({ page }) => {
      const response = await page.request.get(`${frenchPath}?from=bookmark`, { maxRedirects: 0 });

      expect(response.status()).toBe(301);
      expect(response.headers().location).toBe(`${englishPath}?from=bookmark`);
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
