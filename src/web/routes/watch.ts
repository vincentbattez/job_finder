import type { ActionFunctionArgs } from 'react-router';

import { tFor } from '#/actions/i18n.ts';
import { codedError } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { readParameters } from '#/web/parameters.server.ts';
import { relayAction } from '#/web/relay-action.server.ts';

// The buttons of a Watch in the Profile, for the Candidate of the menu; each answers its own fetcher, a
// refusal in the words of the action.
export async function action({ request }: ActionFunctionArgs) {
  const { candidate, locale } = await readCandidate(request);
  const t = tFor(locale, 'settings');
  const formData = await request.formData();
  const input = {
    candidateId: candidate?.id,
    watchId: formData.get('watchId') ?? undefined,
    source: formData.get('source'),
    parameters: readParameters(formData),
  };
  return relayAction(
    request,
    async () => {
      switch (formData.get('intent')) {
        case 'save': {
          await ACTIONS.saveWatch(input);
          return { message: t('watches.saved'), error: null };
        }
        case 'delete': {
          await ACTIONS.deleteWatch(input);
          return { message: null, error: null };
        }
      }
      throw codedError('unknown_intent', {}, { locale });
    },
    (error) => ({ message: null, error }),
  );
}
