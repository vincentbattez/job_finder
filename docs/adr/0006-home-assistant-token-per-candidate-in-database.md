# Each Candidate's Home Assistant token is stored in the database, and never goes back to the front

> Partly superseded by ADR-0010: the table dedicated to Home Assistant gives way to the one of the Notification Channel family (`CanalNotification`), and the migration copied each Home Assistant Connection into it. Write-only still holds, and extends to every secret Parameter. The fallback to `.env` and `data/config.json` is gone. Since ADR-0011, `Candidat` rows are no longer copied from the config: the front writes them.

Each Candidate sets their Home Assistant Connection from their Profile page: the address of their Home Assistant, a long-lived access token and the notification service that reaches their phone. They are stored in the SQLite database of `data/`, in a separate table, and no longer in `.env` or `data/config.json`. It is the first secret `data/` holds. The front has no authentication (ADR-0002): anything an action returns to it can be read by anyone on the LAN or the VPN. The token is therefore write-only. The front can save or replace it, but no action returns it: the page only shows "configured ✓". An architecture test checks it; a mere convention would end up bypassed by oversight.

## Considered Options

- **Keep `HOME_ASSISTANT_URL` and `HOME_ASSISTANT_TOKEN` in `.env`, shared by all Candidates.** Rejected: a second Candidate can have their own Home Assistant, and setting it required an SSH connection to the Mac mini.
- **Put the connection on the `Candidat` row of the database.** Rejected: these rows are copied from `data/config.json` on each launch and never changed elsewhere. A separate table keeps that rule.
- **Leave the notification service in `data/config.json`.** Rejected: the Profile page picks it from the list the Candidate's Home Assistant returns, so it must be written from the front.
- **Encrypt the token in the database.** Rejected: the key would live on the same machine, in `.env`. It only protects against a leak of the database alone, while the real exposure surface is the front, already closed by write-only.
- **Return the masked token (`abc…xyz`).** Rejected: even a piece of a token has no business in the browser, and "configured ✓" is enough to know where things stand.

## Consequences

- A backup or a copy of `data/` now holds a secret: it is handled like `.env`.
- The test, the "send a test notification" button and the list of notification services go through server-side actions, which read the token from the database without returning it.
- A saved secret is only sent along with the Parameters entered with it, such as the address. If the Candidate, or anyone on the LAN, changes one of them without re-entering the secret, the test and the list of choices go out without the saved secret, and saving leaves it behind. A Parameter picked from a list of the module, such as the notification service, does not count: changing the service keeps the token. What holds for the token holds for every secret Parameter (ADR-0010).
- During the migration, a Candidate without a Home Assistant Connection in the database fell back to `HOME_ASSISTANT_URL` and `HOME_ASSISTANT_TOKEN` from `.env`, and the service from `data/config.json` was copied into the database. This fallback disappeared with ADR-0010, once each Candidate's Connection was saved: without a Notification Channel in the database, no notification goes out, and the failure says so.
- The token is stored in clear in the SQLite database: anyone with shell access to the Mac mini reads it, as they read `.env`.
