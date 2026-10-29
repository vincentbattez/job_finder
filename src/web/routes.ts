import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/offres.tsx'),
  route('offres/:reference', 'routes/offre.tsx'),
  route('candidat', 'routes/candidat.ts'),
  route('design', 'routes/design.tsx'),
] satisfies RouteConfig;
