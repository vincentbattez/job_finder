import type { Locator } from '@playwright/test';

// Every Version of an Artifact of an Interview is folded until asked: the latest one is the last
export async function unfoldLatestVersion(artifact: Locator) {
  await artifact.locator('li > details > summary').last().click();
}
