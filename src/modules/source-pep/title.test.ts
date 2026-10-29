import { describe, expect, it } from 'vitest';

import { createTitleMatcher } from './title.ts';

const matchTitle = createTitleMatcher('attaché de justice');

// Titles of the DSJ feed recorded on 2026-10-29, plus a few spellings it does not have yet
describe('title of an attaché de justice offer', () => {
  it.each([
    'Attaché de justice',
    'Attaché(e) de justice affecté(e) au service correctionnel du siège du TJ de Créteil',
    'Attaché(e) de justice - JPROX - affecté (e) auprès des magistrats du parquet- section pôles spécialisés',
    'ATTACHÉ(E) DE JUSTICE VIFS - TRIBUNAL JUDICIAIRE DE LONS-LE-SAUNIER',
    'ATTACHE(E) DE JUSTICE AU TRIBUNAL JUDICIAIRE DU MANS - PARQUET',
    'Attaché.e de justice - Pôle VIF - TJ de Pontoise',
    'ATTACHE DE JUSTICE – PARQUET - TJ MONTARGIS',
    'attaché de justice - lutte contre les violences intrafamiliales',
    "Poste d'attaché(e) de justice auprès du parquet du tribunal judiciaire de Cusset",
    'PV- TJ NEVERS - ATTACHE DE JUSTICE "VIOLENCES INTRA FAMILIALES -VIF"',
    'TJ MULHOUSE - Attaché de justice affecté auprès des magistrats du siège - pôle vif',
    'Attachée de justice au pôle civil',
    'Attaché(e)s de justice au parquet',
  ])('retains « %s »', (title) => {
    expect(matchTitle(title)).toBe('retained');
  });

  it.each([
    'Chef du pôle des attachés de justice et des assistants spécialisés - RHG6 (H/F)',
    "Attaché d'administration- chef de cabinet procureur en charge de la communication   du TJ de Paris",
    "Attaché d'administration : CHEF(FE) DE CABINET DU PRESIDENT DU TRIBUNAL DE BETHUNE",
    "ATTACHE - CHEF(FE) DE CABINET DE LA PROCUREURE GENERALE DE LA COUR D'APPEL D'ANGERS",
  ])('sets aside « %s » as a near miss', (title) => {
    expect(matchTitle(title)).toBe('near-miss');
  });

  it.each([
    'Assistant spécialisé rattaché à la 3ème chambre civile - siège du Tribunal Judiciaire de Paris',
    'Assistant(e) de justice - tribunal pour enfants de Metz',
    'Contractuel C - Tribunal Judiciaire de Nanterre (H/F)',
  ])('rejects « %s »', (title) => {
    expect(matchTitle(title)).toBe('rejected');
  });
});
