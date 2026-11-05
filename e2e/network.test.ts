import { expect, test, type Request } from '@playwright/test';
import { z } from 'zod/v4';

// The e2e tests run without network (CODING_STANDARDS, Tests): every response a page gets comes from
// the dev server. An external dependency fails here before it slows the run down.
//
// The guard watches the requests, not the responses: one that hangs on a host gets no response either.
// What it asserts is that no request to another host than the dev server's gets through.
test('loads the home page with no request answered by another host than the dev server', async ({ page, baseURL }) => {
  const { hostname } = new URL(z.string().parse(baseURL));
  const foreignRequestList: Request[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).hostname !== hostname) foreignRequestList.push(request);
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const answeredUrlList = foreignRequestList
    .filter((request) => request.failure() === null)
    .map((request) => request.url());
  expect(answeredUrlList).toEqual([]);
});
