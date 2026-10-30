import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/offres.tsx'),
  route('offres/:reference', 'routes/offre.tsx'),
  route('offres/:reference/statut', 'routes/statut.ts'),
  route('offres/:reference/:artefact/document', 'routes/document.ts'),
  route('offres/:reference/:artefact/retenue', 'routes/version-retenue.ts'),
  route('offres/:reference/visualisation/:number', 'routes/visualisation.ts'),
  route('candidat', 'routes/candidat.ts'),
  route('profil', 'routes/profil.tsx'),
  route('connexion-home-assistant', 'routes/connexion-home-assistant.ts'),
  route('consignes', 'routes/consignes.tsx'),
  route('run', 'routes/run.ts'),
  route('detect', 'routes/detect.ts'),
  route('import', 'routes/import.ts'),
  route('design', 'routes/design.tsx'),
] satisfies RouteConfig;
