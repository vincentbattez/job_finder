import { useTranslation } from 'react-i18next';
import {
  Link,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaArgs,
} from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { CopyCommand } from '#/web/components/copy-command.tsx';
import { EmptyState } from '#/web/components/empty-state.tsx';
import { FactsForm } from '#/web/components/facts-form.tsx';
import { ProfileFile, ProfileFileCreation } from '#/web/components/profile-file.tsx';
import { NotificationChannelForm } from '#/web/containers/notification-channel.tsx';
import { renderPostForm } from '#/web/containers/post-form.tsx';
import { Uploads } from '#/web/containers/uploads.tsx';
import { Watches } from '#/web/containers/watches.tsx';
import { translateParameters } from '#/web/parameters.server.ts';
import { relayAction, relayLoader } from '#/web/relay-action.server.ts';

export function loader({ request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const { candidate, locale } = await readCandidate(request);
    return {
      candidate,
      locale,
      profileFileList: candidate === null ? [] : await ACTIONS.listProfileFiles({ candidateId: candidate.id }),
      uploadList: candidate === null ? [] : await ACTIONS.listUploads({ candidateId: candidate.id }),
      sectionList: candidate === null ? [] : await ACTIONS.readFacts({ candidateId: candidate.id }),
      channel: candidate === null ? null : await ACTIONS.readNotificationChannel({ candidateId: candidate.id }),
      channelModuleList: translateParameters(await ACTIONS.listNotificationChannels(), locale),
      watchList: candidate === null ? [] : await ACTIONS.listWatches({ candidateId: candidate.id }),
      sourceList: translateParameters(await ACTIONS.listSources(), locale),
    };
  });
}

// The Candidate is the one of the menu, never one the form names; a refusal goes back to the file
// it concerns, in the words of the action
export async function action({ request }: ActionFunctionArgs) {
  const { candidate } = await readCandidate(request);
  if (candidate === null) {
    return redirect('/profile');
  }
  const formData = await request.formData();
  const intent = formData.get('intent');
  const fileName = formData.get('fileName');
  const formInput = { candidateId: candidate.id, fileName, markdown: formData.get('markdown') };
  return relayAction(
    request,
    async () => {
      switch (intent) {
        case 'create': {
          await ACTIONS.createProfileFile(formInput);
          break;
        }
        case 'delete': {
          await ACTIONS.deleteProfileFile(formInput);
          break;
        }
        case 'save': {
          await ACTIONS.saveProfileFile(formInput);
          break;
        }
        case 'upload': {
          // No file at all is refused by the action, like a file that is not a PDF
          const upload = formData.get('upload');
          const file = upload instanceof File ? upload : new File([], '');
          await ACTIONS.saveUpload({
            candidateId: candidate.id,
            fileName: file.name,
            content: new Uint8Array(await file.arrayBuffer()),
          });
          break;
        }
        case 'deleteUpload': {
          await ACTIONS.deleteUpload(formInput);
          break;
        }
        case 'convertUpload': {
          await ACTIONS.convertUpload(formInput);
          break;
        }
        case 'facts': {
          // Each field is named after its section, one per entry of a list section
          const titleList = [...new Set(formData.keys())].filter((name) => name !== 'intent');
          await ACTIONS.saveFacts({
            candidateId: candidate.id,
            entryListByTitle: Object.fromEntries(titleList.map((title) => [title, formData.getAll(title)])),
          });
          break;
        }
      }
      // The Uploads are sent by a fetcher, which revalidates the page by itself and keeps what it receives
      return intent === 'upload' || intent === 'deleteUpload' || intent === 'convertUpload'
        ? { refusal: null }
        : redirect('/profile');
    },
    (message) => ({ refusal: { isCreation: intent === 'create', fileName, message } }),
  );
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: tFor(localeOf(loaderData), 'settings')('profile.pageTitle') }];
}

export default function Profile() {
  const { candidate, profileFileList, uploadList, sectionList, channel, channelModuleList, watchList, sourceList } =
    useLoaderData<typeof loader>();
  const refusal = useActionData<typeof action>()?.refusal ?? null;
  const { t } = useTranslation('settings');
  return (
    <main className="container page">
      {candidate === null ? (
        <div className="page__head">
          <h1>{t('profile.noCandidateHeading')}</h1>
          <p>
            {t('profile.noCandidateHintStart')} <Link to="/candidates">{t('profile.noCandidateHintLink')}</Link>{' '}
            {t('profile.noCandidateHintEnd')}
          </p>
        </div>
      ) : (
        <>
          <div className="page__head">
            <h1>{t('profile.heading', { candidateName: candidate.name })}</h1>
            <p>{t('profile.intro')}</p>
          </div>
          {/* Keyed by their content, so that a save of one shows in the other */}
          <FactsForm key={JSON.stringify(sectionList)} sectionList={sectionList} renderForm={renderPostForm} />
          <Uploads uploadList={uploadList} />
          {profileFileList.length === 0 ? (
            <EmptyState>
              <p>{t('profile.emptyHint')}</p>
              <CopyCommand command={`jf profile ${candidate.id}`} />
              <p>{t('profile.emptyManualHint')}</p>
            </EmptyState>
          ) : (
            profileFileList.map(({ fileName, markdown }) => (
              <ProfileFile
                key={`${fileName}:${markdown}`}
                fileName={fileName}
                markdown={markdown}
                renderForm={renderPostForm}
                error={
                  refusal !== null && !refusal.isCreation && refusal.fileName === fileName ? refusal.message : null
                }
              />
            ))
          )}
          {/* Remounted once the files change, so a created file leaves an empty form behind */}
          <ProfileFileCreation
            key={profileFileList.map(({ fileName }) => fileName).join('/')}
            error={refusal?.isCreation === true ? refusal.message : null}
            renderForm={renderPostForm}
          />
          <Watches watchList={watchList} sourceList={sourceList} />
          {channel !== null && <NotificationChannelForm channel={channel} moduleList={channelModuleList} />}
        </>
      )}
    </main>
  );
}
