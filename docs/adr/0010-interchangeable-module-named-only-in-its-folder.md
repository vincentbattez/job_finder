# An interchangeable module is named only in its folder, the rest of the application only knows its family

Several modules sometimes do the same job, and the Candidate picks which one they use: each Notification Channel (Home Assistant today, e-mail or Telegram tomorrow), each Source a Watch follows (the PEP today). These are interchangeable modules, grouped in families. A family has a contract, in `src/<family>/`: what each module of the family can do (send a notification, detect Postings) and how it describes its Parameters. Each module lives in `src/modules/<family>-<name>/`, for example `src/modules/notification-home-assistant/`. It exports a descriptor that follows this contract: its id, its display name, its Parameters (required, optional, secret) described by a Zod schema, and its operations.

The rest of the application only knows the family. The database has one table per family, which keeps the id of the chosen module and its Parameters as Json, parsed by the module's schema. The domain, the actions and the front handle the family, and the front's form is built from the descriptor. A module's name (`home-assistant`, `HomeAssistant`, `Home Assistant`) appears only in its folder and in the registry `src/actions/modules.ts`, the only file that imports the modules of a family. An architecture test checks it, because a rule that is only written ends up bypassed by oversight. Adding a module means creating a folder and adding a line to the registry, with no migration, no new screen and no new action.

This is what ADR-0003 meant by "Notification channels are interchangeable": a module is changed or added without touching the rest.

## Considered Options

- **A table, a domain type, actions and a front component for each module** (`ConnexionHomeAssistant`, `saveConnexionHomeAssistant`, `connexion-home-assistant.tsx`). This is what #30 delivered. Rejected: a second Channel would need a migration, a new type, new actions and a new screen. The name Home Assistant ended up in 14 files outside its module.
- **One column per Parameter in a shared table** (`url`, `token`, `service`, `email`…). Rejected: each module would add its columns, and most would stay empty for the others.
- **Parameters as Json without a schema.** Rejected: SQLite does not check Json (ADR-0004, ADR-0005). Only the module knows its Parameters, so its schema parses them.
- **The registry in the family's folder.** Rejected: a module of `src/modules/` imports no other (ADR-0003). The registry lives in the actions, which already compose the modules.

## Consequences

- A secret Parameter, such as a Home Assistant's token, is write-only for every module, on the model of ADR-0006: no action returns it and `test/write-only-token.test.ts` checks it. The descriptor marks it as secret, and the front shows "configured ✓".
- What a module offers on top (testing the connection, listing the notification services of its Home Assistant) goes through generic family actions, such as testing the Channel or listing the choices of a Parameter. The descriptor declares what the module offers.
- User-facing messages that name the module ("Home Assistant does not respond") come from the module itself.
- The "least code" principle still holds: a family keeps a single module until a second one is asked for. The contract is what must be generic, not the number of implementations.
- The `source-import` module is not a Source a Watch picks: it is the manual import of a Job Description. It stays an ordinary module, outside the family.
- For Sources, the family's table is `Veille`: each Watch keeps the id of its Source and its Parameters as Json. The Zone is one of them: each Source expresses it its own way (court-of-appeal jurisdictions for the PEP, ADR-0001) and alone says whether a Posting is in it. The domain only keeps this verdict, `Offre.isInZone`, which decides on the Research. A Zone shared by all Sources was ruled out: a Source without courts of appeal could not have read it.
