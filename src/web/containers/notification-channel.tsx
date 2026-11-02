import { BellRingIcon, PlugZapIcon, RefreshCwIcon, SaveIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher, type FetcherWithComponents } from 'react-router';

import type { Actions } from '#/actions/index.ts';
import { PARAMETER_FIELD_PREFIX, ParameterField } from '#/web/components/parameter-field.tsx';
import { SettingsSection } from '#/web/components/settings-section.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Label } from '#/web/components/ui/label.tsx';
import { NativeSelect } from '#/web/components/ui/native-select.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';

import { useFeedback } from './use-feedback.ts';

type NotificationChannel = Awaited<ReturnType<Actions['readNotificationChannel']>>;
type NotificationChannelModule = Awaited<ReturnType<Actions['listNotificationChannels']>>[number];
type Parameter = NotificationChannelModule['parameterList'][number];
type ParameterChoice = Awaited<ReturnType<Actions['listParameterChoices']>>[number];

// What /notification-channel answers each button: the refusal, or the choices it listed
interface IOutcome {
  error?: string | null;
  choiceList?: ParameterChoice[] | null;
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

// A Parameter chosen among what the module lists, such as a service of the Channel, with the button
// that lists them again
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
  const fieldId = useId();
  const fetcher = useFetcher<IOutcome>();
  const { t } = useTranslation('settings');
  useFeedback(fetcher, () => t('notificationChannel.choicesFound', { count: fetcher.data?.choiceList?.length ?? 0 }));
  const valueList = fetcher.data?.choiceList?.map(({ value }) => value) ?? (savedValue === '' ? [] : [savedValue]);
  return (
    <div className="grid gap-2">
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="flex gap-2">
        <NativeSelect id={fieldId} name={`${PARAMETER_FIELD_PREFIX}${name}`} defaultValue={savedValue}>
          {/* A hint, never a choice: a Parameter left out keeps the one saved */}
          <option value="" disabled>
            {valueList.length === 0 ? t('notificationChannel.reloadChoicesFirst') : t('notificationChannel.choose')}
          </option>
          {valueList.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title={t('notificationChannel.reloadChoicesOf', { label })}
          aria-label={t('notificationChannel.reloadChoicesOf', { label })}
          disabled={!isHydrated}
          isPending={fetcher.state !== 'idle'}
          onClick={() => {
            send(form, fetcher, 'choices', name);
          }}
        >
          <RefreshCwIcon />
        </Button>
      </div>
    </div>
  );
}

// The Candidate's Notification Channel, which sends them each Detection Summary: a module of the
// family, and the form its descriptor describes (ADR-0010). Each button ends in its toast.
export function NotificationChannelForm({
  channel,
  moduleList,
}: Readonly<{ channel: NotificationChannel; moduleList: NotificationChannelModule[] }>) {
  const isHydrated = useIsHydrated();
  const { t } = useTranslation('settings');
  const channelId = useId();
  const formReference = useRef<HTMLFormElement>(null);
  const secretInputList = useRef(new Set<HTMLInputElement>());
  const [moduleId, setModuleId] = useState(channel.module ?? moduleList[0]?.id ?? '');
  const saveFetcher = useFetcher<IOutcome>();
  const testFetcher = useFetcher<IOutcome>();
  const notifyFetcher = useFetcher<IOutcome>();
  useFeedback(saveFetcher, () => t('notificationChannel.saved'));
  useFeedback(testFetcher, () => t('notificationChannel.answers'));
  useFeedback(notifyFetcher, () => t('notificationChannel.notified'));
  const module = moduleList.find(({ id }) => id === moduleId);
  // The saved Parameters belong to the saved module: another one starts blank
  const isSavedModule = channel.module === moduleId;

  // Once saved, the secrets leave the page: their fields empty, « configured » takes over (ADR-0006)
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
    <SettingsSection heading={t('notificationChannel.heading')} description={t('notificationChannel.intro')}>
      <form
        ref={formReference}
        method="post"
        action="/notification-channel"
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          send(formReference, saveFetcher, 'save');
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor={channelId}>{t('notificationChannel.channel')}</Label>
          <NativeSelect
            id={channelId}
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
          </NativeSelect>
        </div>
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
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {module?.isTestable === true && (
            <Button
              type="button"
              variant="outline"
              disabled={!isHydrated}
              isPending={testFetcher.state !== 'idle'}
              onClick={() => {
                send(formReference, testFetcher, 'test');
              }}
            >
              <PlugZapIcon />
              {t('notificationChannel.test')}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={!isHydrated}
            isPending={notifyFetcher.state !== 'idle'}
            onClick={() => {
              send(formReference, notifyFetcher, 'notify');
            }}
          >
            <BellRingIcon />
            {t('notificationChannel.notify')}
          </Button>
          <Button type="submit" disabled={!isHydrated} isPending={saveFetcher.state !== 'idle'}>
            <SaveIcon />
            {t('notificationChannel.save')}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
