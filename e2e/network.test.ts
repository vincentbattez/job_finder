import { expect, test } from '@playwright/test';

// The e2e tests run without network (CODING_STANDARDS, Tests): every response a page gets comes from
// the dev server. Google Fonts, the one external dependency of src/web/root.tsx, is resolved to
// nothing in playwright.config.ts (#113); a new one fails here before it slows the run down
test('loads the home page with responses from the dev server only', async ({ page }) => {
  const foreignUrlList: string[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).hostname !== 'localhost') foreignUrlList.push(response.url());
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(foreignUrlList).toEqual([]);
});
