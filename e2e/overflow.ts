import type { Page } from '@playwright/test';

// Léa reads the front on her phone through the VPN (ADR-0002). overflow-x: clip hides a horizontal
// scrollbar, so the check is that nothing runs past the right edge, where it would be cut off. The
// map lays its tiles and points out past its edges and clips them: only the map itself counts. A strip
// that scrolls sideways, such as the tabs of the Posting page, keeps what passes its edge reachable. On
// a cold dev server the stylesheet may apply after the page shows: the caller polls until it does.
export function findOverflowing(page: Page): Promise<string[]> {
  return page.locator('body').evaluate((body) =>
    [...body.querySelectorAll('*')]
      .filter((element) => element.parentElement?.closest('.leaflet-container') === null)
      .filter((element) => element.parentElement?.closest('[data-slot="tabs-list"]') === null)
      .filter((element) => element.getBoundingClientRect().right > body.ownerDocument.documentElement.clientWidth)
      .map((element) => element.outerHTML.slice(0, 80)),
  );
}
