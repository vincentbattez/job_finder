# Independent modules, linked by the Artifacts and a job queue

Each function is an independent module: each Source, the Detection, the Research, the Letter, the Interview Brief, the Visualization and the Notification. A module has its own folder and a single entry point, and its prompts live in separate files. Modules never call each other. They read the Job Description and the Artifacts on disk, then write their own Artifact. The front, the CLI and the Detection never start a module directly: they add a job to an SQLite queue. A separate worker, declared as an lpm service, drains this queue by running a single `claude -p` session at a time, which keeps us within the Claude Code subscription. Only the Detection runs on a schedule, through a daily lpm automation. Everything else is started by a human, except the Research of a new Posting in the Zone, which starts automatically.

We want to be able to change or run a module alone without touching the rest. With a worker separate from the front, restarting the front during development does not cut a running session, and the number of concurrent Claude sessions stays bounded.

## Considered Options

- **The front runs `claude -p` itself.** Less code, but a front restart cuts the running sessions, and two clicks start two sessions in parallel.
- **One lpm automation per step, polling the database at regular intervals.** Rejected: apart from the Detection, steps must be started by the Candidate, not on a schedule.
- **LangGraph (or another LLM orchestration framework).** Rejected:
  - Its nodes call the model with an API key (`ChatAnthropic`), so outside the Claude Code subscription.
  - We would have to re-code the tools Claude Code already provides: web search, reading and writing files, skills.
  - Each module is a single independent session, with no in-memory graph to orchestrate. The SQLite queue and the Artifacts already cover persistence.

## Consequences

- The front and the CLI are two ways of calling the same actions. No business rule lives in either, so that each feature has a single source of truth. The whole main flow can therefore be done from the CLI.
- A module's prompt has two parts:
  - A fixed part, written in the code: what the module reads, the format and location of what it produces, and the non-negotiable rules (never invent a fact, never touch a Posting's Status).
  - Its Instructions: a Candidate can replace them entirely, but cannot touch the fixed part, so a clumsy override does not break the module. Each Version keeps track of the Instructions that produced it.
- Notification channels are interchangeable (Home Assistant, e-mail, Telegram…) and each Candidate picks theirs. v0 only implements Home Assistant.
