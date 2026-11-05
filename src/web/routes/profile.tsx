import { useTranslation } from 'react-i18next';
import {
  Link,
  redirect,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaArgs,
} from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { codedError, profileDocumentKindOf } from '#/actions/index.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { CopyCommand } from '#/web/components/copy-command.tsx';
import { PageHeader } from '#/web/components/page-header.tsx';
import { SettingsSection } from '#/web/components/settings-section.tsx';
import { Alert, AlertDescription } from '#/web/components/ui/alert.tsx';
import { FactsForm } from '#/web/containers/facts.tsx';
import { useProfileDeletion } from '#/web/containers/profile-deletion.tsx';
import { AnnexCreation, ProfileDocument, ProfileFileCreation } from '#/web/containers/profile-documents.tsx';
import { Uploads } from '#/web/containers/uploads.tsx';
import { Watches } from '#/web/containers/watches.tsx';
import { translateParameters } from '#/web/parameters.server.ts';
import { relayAction, relayLoader } from '#/web/relay-action.server.ts';

export function loader({ request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const { candidate, locale } = await readCandidate(request);
    const profileFileList = candidate === null ? [] : await ACTIONS.listProfileFiles({ candidateId: candidate.id });
    return {
      candidate,
      locale,
      documentList: profileFileList.map(({ fileName, markdown }) => ({
        fileName,
        markdown,
        kind: profileDocumentKindOf(fileName),
      })),
      uploadList: candidate === null ? [] : await ACTIONS.listUploads({ candidateId: candidate.id }),
      sectionList: candidate === null ? [] : await ACTIONS.readFacts({ candidateId: candidate.id }),
      watchList: candidate === null ? [] : await ACTIONS.listWatches({ candidateId: candidate.id }),
      sourceList: translateParameters(await ACTIONS.listSources(), locale),
    };
  });
}

// The Candidate is the one of the menu, never one the form names. Every form is a fetcher, which
// revalidates the page by itself and ends in its toast.
export async function action({ request }: ActionFunctionArgs) {
  const { candidate } = await readCandidate(request);
  if (candidate === null) {
    return redirect('/profile');
  }
  return relayAction(request, async () => {
    const formData = await request.formData();
    const formInput = {
      candidateId: candidate.id,
      fileName: formData.get('fileName'),
      markdown: formData.get('markdown'),
    };
    switch (formData.get('intent')) {
      case 'create': {
        await ACTIONS.createProfileFile(formInput);
        break;
      }
      case 'annex': {
        await ACTIONS.addAnnex({ ...formInput, title: formData.get('title') });
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
        // Each field is named after its Section, one per entry of a list Section
        const titleList = [...new Set(formData.keys())].filter((name) => name !== 'intent');
        await ACTIONS.saveFacts({
          candidateId: candidate.id,
          entryListByTitle: Object.fromEntries(titleList.map((title) => [title, formData.getAll(title)])),
        });
        break;
      }
      default: {
        throw codedError('unknown_intent');
      }
    }
    // A new answer each time, by which the feedback of the fetcher tells that its mutation settled
    return { error: null };
  });
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  return [{ title: tFor(localeOf(loaderData), 'settings')('profile.pageTitle') }];
}

export default function Profile() {
  const { candidate, documentList, uploadList, sectionList, watchList, sourceList } = useLoaderData<typeof loader>();
  const { t } = useTranslation('settings');
  const deletion = useProfileDeletion();

  if (candidate === null) {
    return (
      <main>
        <PageHeader title={t('profile.noCandidateHeading')} />
        <p className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:px-8">
          {t('profile.noCandidateHintStart')}{' '}
          <Link to="/settings#candidates" className="text-primary underline underline-offset-4">
            {t('profile.noCandidateHintLink')}
          </Link>{' '}
          {t('profile.noCandidateHintEnd')}
        </p>
      </main>
    );
  }

  function renderDocumentRows(kind: (typeof documentList)[number]['kind']) {
    return (
      <ul className="grid divide-y">
        {documentList
          .filter((document) => document.kind === kind)
          .map(({ fileName, markdown }) => (
            <ProfileDocument key={fileName} fileName={fileName} markdown={markdown} deletion={deletion} />
          ))}
      </ul>
    );
  }

  function renderDocumentsOr(kind: (typeof documentList)[number]['kind'], emptyHint: string) {
    return documentList.some((document) => document.kind === kind) ? (
      renderDocumentRows(kind)
    ) : (
      <p className="text-sm text-muted-foreground">{emptyHint}</p>
    );
  }

  return (
    <main>
      <PageHeader title={t('profile.heading', { candidateName: candidate.name })} description={t('profile.intro')} />
      <div className="mx-auto grid max-w-3xl gap-6 px-4 pt-6 pb-24 sm:px-6 lg:px-8">
        {documentList.length === 0 && (
          <Alert>
            <AlertDescription className="grid gap-2">
              <p>{t('profile.emptyHint')}</p>
              <CopyCommand command={`jf profile ${candidate.id}`} />
              <p>{t('profile.emptyManualHint')}</p>
            </AlertDescription>
          </Alert>
        )}
        <SettingsSection heading={t('profile.cvHeading')} description={t('profile.cvDescription')}>
          {renderDocumentsOr('cv', t('profile.noCv'))}
        </SettingsSection>
        <SettingsSection heading={t('facts.heading')} description={t('facts.intro')}>
          <FactsForm sectionList={sectionList} />
          {renderDocumentRows('facts')}
        </SettingsSection>
        <SettingsSection heading={t('profile.pastLettersHeading')} description={t('profile.pastLettersDescription')}>
          {renderDocumentsOr('past_letter', t('profile.noPastLetter'))}
        </SettingsSection>
        <SettingsSection heading={t('profile.annexesHeading')} description={t('profile.annexesDescription')}>
          {renderDocumentsOr('annex', t('profile.noAnnex'))}
          <div>
            <AnnexCreation />
          </div>
        </SettingsSection>
        <SettingsSection heading={t('uploads.heading')} description={t('uploads.description')}>
          <Uploads uploadList={uploadList} deletion={deletion} />
        </SettingsSection>
        <SettingsSection heading={t('profileFile.creationHeading')} description={t('profileFile.creationDescription')}>
          <ProfileFileCreation />
        </SettingsSection>
        <Watches watchList={watchList} sourceList={sourceList} />
      </div>
      {deletion.dialog}
    </main>
  );
}
