import type { ActionFunctionArgs } from 'react-router';

import { tFor } from '#/actions/i18n.ts';
import { messageOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { readParameters } from '#/web/parameters.server.ts';

// The buttons of a Watch in the Profile, for the Candidate of the menu; each answers its own fetcher, a
// refusal in the words of the action. A list Parameter comes one value per line, as its descriptor says.
export async function action({ request }: ActionFunctionArgs) {
  const { candidate, locale } = await readCandidate(request);
  const t = tFor(locale, 'settings');
  const formData = await request.formData();
  const sourceId = formData.get('source');
  const sourceList = await ACTIONS.listSources();
  const input = {
    candidateId: candidate?.id,
    watchId: formData.get('watchId') ?? undefined,
    source: sourceId,
    parameters: readParameters(formData, sourceList.find(({ id }) => id === sourceId)?.parameterList),
  };
  try {
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
  } catch (error) {
    return { message: null, error: messageOf(error) };
  }
  return { message: null, error: t('unknownIntent') };
}
