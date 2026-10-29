import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/offres.tsx'),
  route('offres/:reference', 'routes/offre.tsx'),
  route('offres/:reference/statut', 'routes/statut.ts'),
  route('offres/:reference/:artefact/document', 'routes/document.ts'),
  route('offres/:reference/:artefact/retenue', 'routes/version-retenue.ts'),
  route('candidat', 'routes/candidat.ts'),
  route('run', 'routes/run.ts'),
  route('detect', 'routes/detect.ts'),
  route('design', 'routes/design.tsx'),
] satisfies RouteConfig;
