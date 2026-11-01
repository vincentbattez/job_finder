import type { Locator } from '@playwright/test';

// Every Version of an Artifact is folded until asked, the Chosen one too: whatever the locale, it
// is the one with the Chosen badge
export async function unfoldChosenVersion(artifact: Locator) {
  await artifact
    .locator('li > details > summary')
    .filter({ has: artifact.page().locator('[data-chosen]') })
    .click();
}
