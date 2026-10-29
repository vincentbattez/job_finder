import type { LoaderFunctionArgs } from 'react-router';

import { ACTIONS } from '#/web/acl/actions.server.ts';

// A Claude session that read the web wrote the page: it runs no script and loads nothing from
// outside, even opened on its own, beside the sandbox of the frame of the fiche
const CONTENT_SECURITY_POLICY = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";

// The page of a Visualisation Version, which the fiche of the Offre shows in a frame
export async function loader({ params }: LoaderFunctionArgs) {
  const { html } = await ACTIONS.readVisualisation(params);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CONTENT_SECURITY_POLICY },
  });
}
