import { index, route, type RouteConfig } from '@react-router/dev/routes';

import { REDIRECT_LIST } from './redirects.ts';

export default [
  index('routes/offres.tsx'),
  route('offres/:reference', 'routes/offre.tsx'),
  route('offres/:reference/statut', 'routes/statut.ts'),
  route('offres/:reference/:artefact/document', 'routes/document.ts'),
  route('offres/:reference/:artefact/retenue', 'routes/version-retenue.ts'),
  route('offres/:reference/visualisation/:number', 'routes/visualisation.ts'),
  route('candidate', 'routes/candidate.ts'),
  route('profile', 'routes/profile.tsx'),
  route('canal-notification', 'routes/canal-notification.ts'),
  route('veille', 'routes/veille.ts'),
  route('candidates', 'routes/candidates.tsx'),
  route('instructions', 'routes/instructions.tsx'),
  route('run', 'routes/run.ts'),
  route('detect', 'routes/detect.ts'),
  route('import', 'routes/import.ts'),
  route('design', 'routes/design.tsx'),
  ...REDIRECT_LIST.map(({ from }) => route(from, 'routes/redirect.ts', { id: `redirect/${from}` })),
] satisfies RouteConfig;
