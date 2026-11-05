import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { codedError } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { Revision } from '#/web/containers/revision.tsx';
import { relayAction, relayLoader } from '#/web/relay-action.server.ts';

// Full screen, out of the Sidebar (spec #125, « Reading and Revision »): the root reads it
export const handle = { isFullScreen: true };

export function loader({ params, request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const interview = { reference: params.reference, number: params.number };
    const [{ locale }, detail, savedList] = await Promise.all([
      readCandidate(request),
      ACTIONS.readPosting({ reference: params.reference }),
      ACTIONS.readRevision(interview),
    ]);
    return { locale, detail, number: Number(params.number), savedList, now: Date.now() };
  });
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  const t = tFor(localeOf(loaderData), 'posting');
  return [
    {
      title: t('revision.pageTitle', {
        number: loaderData?.number ?? '',
        postingTitle: loaderData?.detail.posting.title ?? t('unreadPosting'),
      }),
    },
  ];
}

// The margin's note and Mastered toggle post here through their fetchers, which revalidate the page; a
// refusal goes back to the form, which keeps what was typed
export function action({ params, request }: ActionFunctionArgs) {
  return relayAction(request, async () => {
    const formData = await request.formData();
    const section = { reference: params.reference, number: params.number, title: formData.get('title') };
    switch (formData.get('intent')) {
      case 'note': {
        await ACTIONS.writeRevisionNote({ ...section, note: formData.get('note') });
        break;
      }
      case 'mastered': {
        await ACTIONS.markMastered({ ...section, isMastered: formData.get('isMastered') });
        break;
      }
      default: {
        const { locale } = await readCandidate(request);
        throw codedError('unknown_intent', {}, { locale });
      }
    }
    return null;
  });
}

export default function RevisionPage() {
  const data = useLoaderData<typeof loader>();
  return <Revision {...data} />;
}
