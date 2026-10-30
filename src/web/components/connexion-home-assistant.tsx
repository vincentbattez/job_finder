import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useFetcher, type FetcherWithComponents } from 'react-router';

import type { Actions } from '#/actions/index.ts';

import { useIsHydrated } from './use-is-hydrated.ts';

type ConnexionHomeAssistant = Awaited<ReturnType<Actions['readConnexionHomeAssistant']>>;
type NotifyService = Awaited<ReturnType<Actions['listNotifyServices']>>[number];

// What /connexion-home-assistant answers each button: a message or a refusal, and the services
interface IOutcome {
  message: string | null;
  error: string | null;
  serviceList: NotifyService[] | null;
}

type Fetcher = FetcherWithComponents<IOutcome>;

// A button and, beside it, what its last click answered
function Step({
  fetcher,
  isHydrated,
  children,
  ...buttonProperties
}: Readonly<{
  fetcher: Fetcher;
  isHydrated: boolean;
  children: ReactNode;
  type: 'button' | 'submit';
  className?: string;
  onClick?: () => void;
}>) {
  const isIdle = fetcher.state === 'idle';
  return (
    <div className="connexion__step">
      <button {...buttonProperties} disabled={!isHydrated || !isIdle}>
        {children}
      </button>
      {isIdle && fetcher.data?.error != null && <p role="alert">{fetcher.data.error}</p>}
      {isIdle && fetcher.data?.message != null && <p role="status">{fetcher.data.message}</p>}
    </div>
  );
}

// The Candidat's Connexion Home Assistant, which pushes each new Offre to their phone. The token
// field always starts empty: the token is write-only, and left empty it keeps the saved one (ADR-0006).
export function ConnexionHomeAssistantForm({ connexion }: Readonly<{ connexion: ConnexionHomeAssistant }>) {
  const headingId = useId();
  const isHydrated = useIsHydrated();
  const formReference = useRef<HTMLFormElement>(null);
  const tokenReference = useRef<HTMLInputElement>(null);
  const saveFetcher = useFetcher<IOutcome>();
  const testFetcher = useFetcher<IOutcome>();
  const servicesFetcher = useFetcher<IOutcome>();
  const notifyFetcher = useFetcher<IOutcome>();

  // Every button sends the whole form, so a test or a list tries what the Candidat typed, unsaved
  // The intents /connexion-home-assistant relays, one per button
  type Intent = 'save' | 'test' | 'services' | 'notify';
  function send(fetcher: Fetcher, intent: Intent): void {
    const formData = new FormData(formReference.current ?? undefined);
    formData.set('intent', intent);
    void fetcher.submit(formData, { method: 'post', action: '/connexion-home-assistant' });
  }

  // Once saved, the token leaves the page: the field empties, « configuré ✓ » takes over (ADR-0006)
  const isSaved = saveFetcher.state === 'idle' && saveFetcher.data?.error === null;
  useEffect(() => {
    if (isSaved && tokenReference.current !== null) {
      tokenReference.current.value = '';
    }
  }, [isSaved, saveFetcher.data]);

  const serviceList =
    servicesFetcher.data?.serviceList?.map(({ service }) => service) ??
    (connexion.service === null ? [] : [connexion.service]);

  return (
    <section className="connexion" aria-labelledby={headingId}>
      <h2 id={headingId}>Notifications</h2>
      <p>
        Votre Home Assistant envoie chaque nouvelle Offre sur votre téléphone. Le test et la liste des services essaient
        ce que vous avez saisi ; la notification de test part vers ce qui est enregistré.
      </p>
      <form
        ref={formReference}
        method="post"
        action="/connexion-home-assistant"
        onSubmit={(event) => {
          event.preventDefault();
          send(saveFetcher, 'save');
        }}
      >
        <label className="connexion__field">
          Adresse de Home Assistant
          <input
            type="url"
            name="url"
            required
            defaultValue={connexion.url ?? ''}
            placeholder="http://homeassistant.local:8123"
          />
        </label>
        <label className="connexion__field">
          <span>
            Jeton d’accès longue durée
            {connexion.isTokenConfigured && <span className="connexion__configured"> configuré ✓</span>}
          </span>
          <input
            ref={tokenReference}
            type="password"
            name="token"
            autoComplete="off"
            placeholder={
              connexion.isTokenConfigured
                ? 'Laisser vide pour garder le jeton enregistré'
                : 'Home Assistant → Profil → Sécurité'
            }
          />
        </label>
        <Step
          type="button"
          fetcher={testFetcher}
          isHydrated={isHydrated}
          onClick={() => {
            send(testFetcher, 'test');
          }}
        >
          Tester la connexion
        </Step>
        <label className="connexion__field">
          Service de notification
          <select name="service" defaultValue={connexion.service ?? ''}>
            {/* A hint, never a choice: a service left out keeps the one saved */}
            <option value="" disabled>
              {serviceList.length === 0 ? 'Rechargez la liste des services' : 'Choisir un service'}
            </option>
            {serviceList.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </label>
        <Step
          type="button"
          fetcher={servicesFetcher}
          isHydrated={isHydrated}
          onClick={() => {
            send(servicesFetcher, 'services');
          }}
        >
          Recharger les services
        </Step>
        <Step type="submit" className="button--primary" fetcher={saveFetcher} isHydrated={isHydrated}>
          Enregistrer
        </Step>
        <Step
          type="button"
          fetcher={notifyFetcher}
          isHydrated={isHydrated}
          onClick={() => {
            send(notifyFetcher, 'notify');
          }}
        >
          Envoyer une notification de test
        </Step>
      </form>
    </section>
  );
}
