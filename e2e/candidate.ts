import { test as base, type Page } from '@playwright/test';
import { z } from 'zod/v4';

import { CANDIDATE_COOKIE } from '#/web/cookies.server.ts';

export type AsCandidate = (candidateId: string) => Promise<void>;
export type OpenPage = (path: string) => Promise<void>;
// What a helper of a spec file takes to open the pages of a test
export interface IFront {
  page: Page;
  openPage: OpenPage;
}

// A test whose subject is not the switcher chooses its Candidate as the switcher would have: through the
// candidate cookie, set on the browser before its first page. It spares each test a page load and a
// form submission on a server that is CPU-bound in CI (#112). The value comes from the app's own
// cookie, so it follows its encoding; were the cookie signed one day, this fixture would sign it too.
// Only the tests of the switcher go through it, with switchCandidate.
//
// The switcher also has every test wait for React before its first click: openPage keeps that wait, as a
// click or a form sent before React runs the page may go nowhere. A test without JavaScript has no
// such wait to make.
export const test = base.extend<{ asCandidate: AsCandidate; openPage: OpenPage }>({
  asCandidate: async ({ context, baseURL }, use) => {
    await use(async (candidateId) => {
      // Set-Cookie as the server would send it: the browser keeps its first attribute, name=value
      const header = await CANDIDATE_COOKIE.serialize(candidateId);
      const [nameAndValue = ''] = header.split(';', 1);
      const value = nameAndValue.slice(nameAndValue.indexOf('=') + 1);
      await context.addCookies([{ name: 'candidate', value, url: z.string().parse(baseURL) }]);
    });
  },
  openPage: async ({ page, javaScriptEnabled }, use) => {
    await use(async (path) => {
      await page.goto(path);
      if (javaScriptEnabled) {
        await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
      }
    });
  },
});

export const { expect } = base;

// Through the Candidate switcher at the head of the Sidebar, as the Candidate would; once React runs it
export async function switchCandidate(page: Page, name: string): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: 'Changer de Candidat' }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
