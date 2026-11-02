import { expect, test } from './candidate.ts';

// These journeys only read: Rennes has a long Research in six sections, its Sources the last, Béthune a Letter with its
// recipients (test/seed-front.ts)
const RENNES_RESEARCH = '/postings/2026-2420931?tab=research';
const BETHUNE_LETTER = '/postings/2026-2445600?tab=letter';

test('reads an Artifact along its rail of numbered sections, with the reading progress', async ({ page, openPage }) => {
  await openPage(RENNES_RESEARCH);
  const rail = page.getByRole('navigation', { name: 'Sections' });
  const progress = rail.getByRole('progressbar', { name: 'Progression de la lecture' });
  await expect(rail.getByRole('listitem')).toHaveCount(6);
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await expect(rail.getByRole('button', { name: 'Le ressort', exact: true })).toHaveAttribute(
    'aria-current',
    'location',
  );

  await rail.getByRole('button', { name: 'Les attentes', exact: true }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Les attentes' })).toBeInViewport();
  await expect(rail.getByRole('button', { name: 'Les attentes', exact: true })).toHaveAttribute(
    'aria-current',
    'location',
  );
  await expect(rail.getByRole('button', { name: 'Le ressort (lue)' })).toBeVisible();
  await expect(rail.getByRole('button', { name: 'Le poste (lue)' })).toBeVisible();
  await expect(rail.getByRole('button', { name: 'Les questions', exact: true })).toBeVisible();
  await expect(progress).not.toHaveAttribute('aria-valuenow', '0');
});

test('folds the rail into a sticky progress line on a narrow screen', async ({ page, openPage }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await openPage(RENNES_RESEARCH);

  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeHidden();
  const progress = page.getByRole('progressbar', { name: 'Progression de la lecture' });
  await expect(progress).toBeVisible();
  await page.getByRole('heading', { level: 2, name: 'Les questions' }).scrollIntoViewIfNeeded();
  await expect(progress).toBeInViewport();
  await expect(progress).not.toHaveAttribute('aria-valuenow', '0');
});

test('sets the reading column at 65 to 75 characters per line', async ({ page, openPage }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await openPage(RENNES_RESEARCH);
  const article = page.getByRole('region', { name: 'Recherche' }).getByRole('article');
  await expect(article.getByRole('heading', { level: 1 })).toBeVisible();

  // Characters on each full line of the paragraphs, the last line of each left out
  const lineLengthList = await article.evaluate(async (element) => {
    await document.fonts.ready;
    const range = document.createRange();
    return [...element.querySelectorAll('p')].flatMap((paragraph) => {
      const countByTop = new Map<number, number>();
      const text = paragraph.firstChild;
      if (text !== null) {
        for (let index = 0; index < (text.textContent ?? '').length; index += 1) {
          range.setStart(text, index);
          range.setEnd(text, index + 1);
          const top = Math.round(range.getBoundingClientRect().top);
          countByTop.set(top, (countByTop.get(top) ?? 0) + 1);
        }
      }
      return countByTop.values().toArray().slice(0, -1);
    });
  });

  expect(lineLengthList.length).toBeGreaterThan(10);
  const averageLength = lineLengthList.reduce((sum, length) => sum + length, 0) / lineLengthList.length;
  expect(averageLength).toBeGreaterThanOrEqual(65);
  expect(averageLength).toBeLessThanOrEqual(75);
});

test('reads the Letter as a page, under the recipients it recommends', async ({ page, openPage }) => {
  await openPage(BETHUNE_LETTER);
  const letter = page.getByRole('region', { name: 'Lettre de motivation' });

  const recipients = letter.getByRole('region', { name: 'Destinataires recommandés' });
  await expect(recipients.getByRole('definition')).toHaveText([
    /^p\.tj-bethune@justice\.fr\s*Mail de candidature$/,
    /^sec\.p\.tj-bethune@justice\.fr\s*Contact 2$/,
    /^Madame la Présidente,\s*Contact 1$/,
  ]);
  await expect(recipients).toContainText('Le mail de candidature est celui de la présidence');
  // The page reads larger than the other Artifacts, as the employer will read it
  await expect(letter.getByRole('article').getByText('Madame la Présidente,')).toHaveCSS('font-size', '18px');
  await expect(letter.getByRole('navigation', { name: 'Sections' })).toHaveCount(0);
});

test('collapses the Sidebar in focus mode, and brings it back', async ({ page, openPage }) => {
  await openPage(RENNES_RESEARCH);
  const sidebar = page.locator('[data-slot="sidebar"]');
  const focusMode = page.getByRole('button', { name: 'Mode focus' });
  await expect(sidebar).toHaveAttribute('data-state', 'expanded');

  await focusMode.click();

  await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
  await expect(focusMode).toHaveAttribute('aria-pressed', 'true');

  await focusMode.click();

  await expect(sidebar).toHaveAttribute('data-state', 'expanded');
  await expect(focusMode).toHaveAttribute('aria-pressed', 'false');
});
