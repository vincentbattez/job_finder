import { describe, expect, it } from 'vitest';

import { findRepublishedOffre } from './index.ts';

// Offres of the DSJ feed recorded on 2026-10-29, their fields as published
const BOULOGNE_PARQUET = {
  reference: '2026-2231960',
  title: 'Attaché de justice affecté auprès des magistrats du parquet TJ BOULOGNE SUR MER',
  workplace: 'Tribunal Judiciaire de Boulogne sur mer',
  applicationEmail: 'chcab.pr.tj-boulogne-sur-mer@justice.fr',
};
const BOULOGNE_PARQUET_REPUBLISHED = {
  reference: '2026-2338409',
  title: 'Attaché de justice affecté auprès des magistrats du parquet',
  workplace: 'Tribunal Judiciaire de Boulogne-sur-mer',
  applicationEmail: 'chcab.pr.tj-boulogne-sur-mer@justice.fr',
};
const BOULOGNE_SIEGE = {
  reference: '2026-2360411',
  title: 'Attaché de justice affecté auprès des magistrats du siège - TJ BOULOGNE SUR MER',
  workplace: 'Tribunal Judiciaire de Boulogne-sur-Mer',
  applicationEmail: 'p.tj-boulogne-sur-mer@justice.fr',
};
const BETHUNE_ENFANTS = {
  reference: '2026-2445600',
  title: 'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE',
  workplace: 'Tribunal Judiciaire de Béthune',
  applicationEmail: 'p.tj-bethune@justice.fr',
};
const BETHUNE_INSTRUCTION = {
  reference: '2026-2445609',
  title: "Attaché de justice affecté auprès des magistrats du siège - Service de l'instruction - TJ BETHUNE",
  workplace: 'Tribunal Judiciaire de Béthune',
  applicationEmail: 'p.tj-bethune@justice.fr',
};
const BETHUNE_PARQUET = {
  reference: '2026-2445183',
  title: 'Attaché de justice affecté auprès des magistrats du parquet - TJ Béthune',
  workplace: 'Tribunal Judiciaire de Béthune',
  applicationEmail: 'chcab.pr.tj-bethune@justice.fr',
};

describe('the Republication of an Offre', () => {
  it('links the Boulogne parquet Offre 2026-2338409 to 2026-2231960, the same Poste published earlier', () => {
    expect(
      findRepublishedOffre(BOULOGNE_PARQUET_REPUBLISHED, [BOULOGNE_SIEGE, BOULOGNE_PARQUET, BETHUNE_PARQUET]),
    ).toBe(BOULOGNE_PARQUET);
  });

  it('links a Poste published a third time to its latest publication', () => {
    const firstPublication = { ...BOULOGNE_PARQUET, reference: '2026-2100000' };

    expect(findRepublishedOffre(BOULOGNE_PARQUET_REPUBLISHED, [BOULOGNE_PARQUET, firstPublication])).toBe(
      BOULOGNE_PARQUET,
    );
  });

  // Same juridiction, two of them with the same workplace and mail: only the service in the title
  // tells the Postes apart
  it.each([
    { offre: BETHUNE_ENFANTS, otherOffreList: [BETHUNE_INSTRUCTION, BETHUNE_PARQUET] },
    { offre: BETHUNE_INSTRUCTION, otherOffreList: [BETHUNE_ENFANTS, BETHUNE_PARQUET] },
    { offre: BETHUNE_PARQUET, otherOffreList: [BETHUNE_ENFANTS, BETHUNE_INSTRUCTION] },
  ])('never mistakes the Béthune Offre $offre.reference for another one', ({ offre, otherOffreList }) => {
    expect(findRepublishedOffre(offre, otherOffreList)).toBeUndefined();
  });

  it.each([
    {
      case: 'two services of one parquet, same workplace and mail (Evry)',
      offre: {
        reference: '2026-2316951',
        title: "Attaché(e) de justice - du parquet du TJ d'Evry - Délinquance routière",
        workplace: "Tribunal judiciaire d'Evry - 9 Rue des Mazières, 91000 Évry-Courcouronnes",
        applicationEmail: 'sg.pr.tj-evry@justice.fr',
      },
      earlierOffre: {
        reference: '2026-2315312',
        title: "Attaché(e) de justice - du parquet du TJ d'Evry - Criminalité organisée",
        workplace: "Tribunal judiciaire d'Evry - 9 Rue des Mazières, 91000 Évry-Courcouronnes",
        applicationEmail: 'sg.pr.tj-evry@justice.fr',
      },
    },
    {
      case: 'two sections of one parquet, same mail, workplace differing in case only (Aix-en-Provence)',
      offre: {
        reference: '2026-2445266',
        title: 'Attaché(e) de justice - action pu. générale - section délinquance des majeurs - parquet TJ Aix-en-Pvce',
        workplace: 'Aix en provence',
        applicationEmail: 'valerie.vincheneux@justice.fr',
      },
      earlierOffre: {
        reference: '2026-2430585',
        title: 'Attaché(e) de justice- VIF  section mineurs famille- Parquet - TJ Aix Jprox',
        workplace: 'Aix en Provence',
        applicationEmail: 'valerie.vincheneux@justice.fr',
      },
    },
    {
      case: 'the siège of one tribunal under nearly the same title, a mail with a note (Melun: pôle civil, then tribunal pour enfants)',
      offre: {
        reference: '2026-2290529',
        title: 'Attaché(e) de justice auprès des magistrats du siège du tribunal judiciaire de Melun H/F',
        workplace: 'Tribunal judiciaire de Melun',
        applicationEmail: 'sec.p.tj-melun@justice.fr',
      },
      earlierOffre: {
        reference: '2026-2285305',
        title: 'Attaché(e) de justice affecté auprès des magistrats du siège du Tribunal judiciaire de Melun  H/F',
        workplace: 'Tribunal judiciaire de Melun',
        applicationEmail: 'sec.p.tj-melun@justice.fr, Secrétariat de la présidence',
      },
    },
    {
      case: 'two Offres of one title without any mail de candidature (Blois, published once in the feed)',
      offre: {
        reference: '2026-2315357',
        title: 'ATTACHE DE JUSTICE - PARQUET DU TRIBUNAL JUDICIAIRE DE BLOIS',
        workplace: 'TRIBUNAL JUDICIAIRE DE BLOIS',
        applicationEmail: null,
      },
      earlierOffre: {
        reference: '2026-2200000',
        title: 'ATTACHE DE JUSTICE - PARQUET DU TRIBUNAL JUDICIAIRE DE BLOIS',
        workplace: 'TRIBUNAL JUDICIAIRE DE BLOIS',
        applicationEmail: null,
      },
    },
  ])('links nothing for $case', ({ offre, earlierOffre }) => {
    expect(findRepublishedOffre(offre, [earlierOffre])).toBeUndefined();
  });
});
