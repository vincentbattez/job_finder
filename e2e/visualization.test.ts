import { expect, test, type Locator } from '@playwright/test';

import { prepareInterview } from './interview.ts';

// The Sens Posting, which test/seed-front.ts leaves without any Artifact and that no other test
// touches: the test marks it Applied, gives it an Interview and produces its Research and the Interview
// Brief of the Interview first. The e2e worker runs the jobs with the fake Claude, whose sessions last
// a second (test/e2e-actions.server.ts).
const REFERENCE = '2026-2344393';

// The worker takes the job, then its session lasts a second, and the Posting page reads the state again
// every two seconds
const READY_TIMEOUT_MS = 15_000;

async function launch(region: Locator, label: string) {
  await region.getByRole('button', { name: `Lancer la ${label}` }).click();
  await expect(region.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });
}

test('launches the Visualization of the Chosen Interview Brief, shows it in a frame, and relaunches it', async ({
  page,
}) => {
  const interview = await prepareInterview(page, REFERENCE);
  const visualization = interview.getByRole('region', { name: 'Visualisation' });
  await expect(visualization).toContainText(`L'Offre ${REFERENCE} n'a pas de Fiche d’entretien retenue`);
  await expect(visualization.getByRole('button', { name: 'Lancer la Visualisation' })).toBeDisabled();
  await launch(page.getByRole('region', { name: 'Recherche' }), 'Recherche');
  await launch(interview.getByRole('region', { name: 'Fiche d’entretien' }), 'Fiche d’entretien');

  await launch(visualization, 'Visualisation');

  await expect(visualization.locator('li > details > summary')).toHaveText([/^v1\s*Prêt\s*Retenue/]);
  const frame = visualization.getByTitle('Visualisation v1');
  await expect(frame).toHaveAttribute('sandbox', '');
  await expect(frame.contentFrame().getByRole('table')).toContainText('Missions, Partenaires, Service');
  // The page comes from a Claude session that read the web: even opened on its own, it runs no
  // script and loads nothing from outside
  const source = (await frame.getAttribute('src')) ?? '';
  expect(source).toBe(`/postings/${REFERENCE}/interviews/1/visualization/1`);
  const response = await page.request.get(source);
  expect(response.headers()).toMatchObject({
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  });
  // Regenerated, never corrected by hand: neither an editor nor a jf edit command
  await expect(visualization.getByRole('textbox')).toHaveCount(0);
  await expect(visualization.getByText('jf edit')).toHaveCount(0);

  await visualization.getByRole('button', { name: 'Relancer la Visualisation' }).click();

  await expect(visualization.locator('li > details > summary')).toHaveText([/^v1\s*Prêt/, /^v2\s*Prêt\s*Retenue/], {
    timeout: READY_TIMEOUT_MS,
  });
  await expect(visualization.getByTitle('Visualisation v2')).toBeVisible();
});
