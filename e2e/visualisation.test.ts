import { expect, test, type Locator } from '@playwright/test';

// The Sens Offre, which test/seed-front.ts leaves without any Artefact and that no other test
// touches: the test produces its Recherche and its Fiche d'entretien first. The e2e worker runs the
// jobs with the fake Claude, whose sessions last a second (test/e2e-actions.server.ts).
const REFERENCE = '2026-2344393';

// The worker takes the job, then its session lasts a second, and the fiche reads the état again
// every two seconds
const READY_TIMEOUT_MS = 15_000;

async function launch(region: Locator, label: string) {
  await region.getByRole('button', { name: `Lancer la ${label}` }).click();
  await expect(region.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });
}

test('launches the Visualisation of the Fiche d’entretien retenue, shows it in a frame, and relaunches it', async ({
  page,
}) => {
  await page.goto(`/offres/${REFERENCE}`);
  const visualisation = page.getByRole('region', { name: 'Visualisation' });
  await expect(visualisation).toContainText(`L'Offre ${REFERENCE} n'a pas de Fiche d’entretien retenue`);
  await expect(visualisation.getByRole('button', { name: 'Lancer la Visualisation' })).toBeDisabled();
  await launch(page.getByRole('region', { name: 'Recherche' }), 'Recherche');
  await launch(page.getByRole('region', { name: 'Fiche d’entretien' }), 'Fiche d’entretien');

  await launch(visualisation, 'Visualisation');

  await expect(visualisation.locator('li > details > summary')).toHaveText([/^v1\s*Prêt\s*Retenue/]);
  const frame = visualisation.getByTitle('Visualisation v1');
  await expect(frame).toHaveAttribute('sandbox', '');
  await expect(frame.contentFrame().getByRole('table')).toContainText('Missions, Partenaires, Service');
  // The page comes from a Claude session that read the web: even opened on its own, it runs no
  // script and loads nothing from outside
  const response = await page.request.get((await frame.getAttribute('src')) ?? '');
  expect(response.headers()).toMatchObject({
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  });
  // Regenerated, never corrected by hand: neither an editor nor a jf edit command
  await expect(visualisation.getByRole('textbox')).toHaveCount(0);
  await expect(visualisation.getByText('jf edit')).toHaveCount(0);

  await visualisation.getByRole('button', { name: 'Relancer la Visualisation' }).click();

  await expect(visualisation.locator('li > details > summary')).toHaveText([/^v1\s*Prêt/, /^v2\s*Prêt\s*Retenue/], {
    timeout: READY_TIMEOUT_MS,
  });
  await expect(visualisation.getByTitle('Visualisation v2')).toBeVisible();
});
