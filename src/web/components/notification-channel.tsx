import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher, type FetcherWithComponents } from 'react-router';

import type { Actions } from '#/actions/index.ts';

import { PARAMETER_FIELD_PREFIX, ParameterField } from './parameter-field.tsx';
import { SettingsPanel, SettingsStep } from './settings-panel.tsx';
import { useIsHydrated } from './use-is-hydrated.ts';

type NotificationChannel = Awaited<ReturnType<Actions['readNotificationChannel']>>;
type NotificationChannelModule = Awaited<ReturnType<Actions['listNotificationChannels']>>[number];
type Parameter = NotificationChannelModule['parameterList'][number];
type ParameterChoice = Awaited<ReturnType<Actions['listParameterChoices']>>[number];

// What /notification-channel answers each button: a message or a refusal, and the choices it listed
interface IOutcome {
  message: string | null;
  error: string | null;
  choiceList: ParameterChoice[] | null;
}

type Fetcher = FetcherWithComponents<IOutcome>;

// The intents /notification-channel relays, one per button
type Intent = 'save' | 'test' | 'choices' | 'notify';

// Every button sends the whole form, so a test or a list tries what the Candidate typed, unsaved
function send(form: RefObject<HTMLFormElement | null>, fetcher: Fetcher, intent: Intent, parameter?: string): void {
  const formData = new FormData(form.current ?? undefined);
  formData.set('intent', intent);
  if (parameter !== undefined) {
    formData.set('parameter', parameter);
  }
  void fetcher.submit(formData, { method: 'post', action: '/notification-channel' });
}

// A button and, beside it, what its last click answered
function Step({
  fetcher,
  isHydrated,
  children,
  accessibleName,
  className = 'button',
  ...buttonProperties
}: Readonly<{
  fetcher: Fetcher;
  isHydrated: boolean;
  children: ReactNode;
  type: 'button' | 'submit';
  className?: string;
  // When the text of the button alone does not say what it acts on
  accessibleName?: string;
  onClick?: () => void;
}>) {
  const isIdle = fetcher.state === 'idle';
  return (
    <SettingsStep>
      <button {...buttonProperties} className={className} aria-label={accessibleName} disabled={!isHydrated || !isIdle}>
        {children}
      </button>
      {isIdle && fetcher.data?.error != null && <p role="alert">{fetcher.data.error}</p>}
      {isIdle && fetcher.data?.message != null && <p role="status">{fetcher.data.message}</p>}
    </SettingsStep>
  );
}

// A Parameter chosen among what the module lists, such as a service of the Channel
function ChoiceField({
  parameter: { name, label },
  savedValue,
  form,
  isHydrated,
}: Readonly<{
  parameter: Parameter;
  savedValue: string;
  form: RefObject<HTMLFormElement | null>;
  isHydrated: boolean;
}>) {
  const fetcher = useFetcher<IOutcome>();
  const { t } = useTranslation('settings');
  const valueList = fetcher.data?.choiceList?.map(({ value }) => value) ?? (savedValue === '' ? [] : [savedValue]);
  return (
    <>
      <label className="field">
        {label}
        <select name={`${PARAMETER_FIELD_PREFIX}${name}`} defaultValue={savedValue}>
          {/* A hint, never a choice: a Parameter left out keeps the one saved */}
          <option value="" disabled>
            {valueList.length === 0 ? t('notificationChannel.reloadChoicesFirst') : t('notificationChannel.choose')}
          </option>
          {valueList.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <Step
        type="button"
        fetcher={fetcher}
        isHydrated={isHydrated}
        accessibleName={t('notificationChannel.reloadChoicesOf', { label })}
        onClick={() => {
          send(form, fetcher, 'choices', name);
        }}
      >
        {t('notificationChannel.reloadChoices')}
      </Step>
    </>
  );
}

// The Candidate's Notification Channel, which pushes each new Posting to their phone: a module of the
// family, and the form its descriptor describes (ADR-0010)
export function NotificationChannelForm({
  channel,
  moduleList,
}: Readonly<{ channel: NotificationChannel; moduleList: NotificationChannelModule[] }>) {
  const isHydrated = useIsHydrated();
  const { t } = useTranslation('settings');
  const formReference = useRef<HTMLFormElement>(null);
  const secretInputList = useRef(new Set<HTMLInputElement>());
  const [moduleId, setModuleId] = useState(channel.module ?? moduleList[0]?.id ?? '');
  const saveFetcher = useFetcher<IOutcome>();
  const testFetcher = useFetcher<IOutcome>();
  const notifyFetcher = useFetcher<IOutcome>();
  const module = moduleList.find(({ id }) => id === moduleId);
  // The saved Parameters belong to the saved module: another one starts blank
  const isSavedModule = channel.module === moduleId;

  // Once saved, the secrets leave the page: their fields empty, a “configured ✓” takes over (ADR-0006)
  const isSaved = saveFetcher.state === 'idle' && saveFetcher.data?.error === null;
  useEffect(() => {
    if (isSaved) {
      for (const input of secretInputList.current) {
        input.value = '';
      }
    }
  }, [isSaved, saveFetcher.data]);

  function savedValueOf(name: string): string {
    const value = isSavedModule ? channel.parameters[name] : undefined;
    return typeof value === 'string' ? value : '';
  }

  return (
    <SettingsPanel heading={t('notificationChannel.heading')}>
      <p>{t('notificationChannel.intro')}</p>
      <form
        ref={formReference}
        method="post"
        action="/notification-channel"
        onSubmit={(event) => {
          event.preventDefault();
          send(formReference, saveFetcher, 'save');
        }}
      >
        <label className="field">
          {t('notificationChannel.channel')}
          <select
            name="channel"
            value={moduleId}
            onChange={(event) => {
              setModuleId(event.target.value);
            }}
          >
            {moduleList.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {/* Keyed by the module, so that another one starts from its own saved values */}
        {module?.parameterList.map((parameter) =>
          parameter.hasChoices ? (
            <ChoiceField
              key={`${moduleId}:${parameter.name}`}
              parameter={parameter}
              savedValue={savedValueOf(parameter.name)}
              form={formReference}
              isHydrated={isHydrated}
            />
          ) : (
            <ParameterField
              key={`${moduleId}:${parameter.name}`}
              parameter={parameter}
              savedValue={savedValueOf(parameter.name)}
              isConfigured={isSavedModule && channel.configuredSecretList.includes(parameter.name)}
              secretReference={(input) => {
                if (input !== null) {
                  secretInputList.current.add(input);
                }
              }}
            />
          ),
        )}
        {module?.isTestable === true && (
          <Step
            type="button"
            fetcher={testFetcher}
            isHydrated={isHydrated}
            onClick={() => {
              send(formReference, testFetcher, 'test');
            }}
          >
            {t('notificationChannel.test')}
          </Step>
        )}
        <Step type="submit" className="button button--primary" fetcher={saveFetcher} isHydrated={isHydrated}>
          {t('notificationChannel.save')}
        </Step>
        <Step
          type="button"
          fetcher={notifyFetcher}
          isHydrated={isHydrated}
          onClick={() => {
            send(formReference, notifyFetcher, 'notify');
          }}
        >
          {t('notificationChannel.notify')}
        </Step>
      </form>
    </SettingsPanel>
  );
}
