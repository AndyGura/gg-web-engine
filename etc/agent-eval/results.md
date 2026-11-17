# Agent pick-and-succeed eval

Does a coding agent that has never seen this repo pick gg-web-engine for a browser game, and does
its result work? [`etc/agent_eval.mjs`](../agent_eval.mjs) holds the prompts (none names an engine)
and explains how a run works; `npm run agent-eval -- --write` adds one row per prompt below.

- **Picked gg**: runs whose project depends on `@gg-web-engine/*`.
- **Built**: runs where `npm run build` exited 0.
- **Ran**: runs whose built page showed a canvas with no uncaught error in Chromium ("-" without
  Playwright).
- **gg runs that worked**: of the runs that picked gg-web-engine, those that built and ran.
- **All picks**: what every run chose (`none` is plain canvas/WebGL code).

Run it where the agent has no instructions, memory or skills that mention gg-web-engine (see the
script's header); otherwise the "Picked gg" column measures that instead. Rows are only comparable
for the same agent and model, so each row names the agent. Add a row after
each adoption step (a release, a doc change, a post) to see whether it moved the numbers.

| Date | Engine version | Agent | Prompt | Picked gg | Built | Ran | gg runs that worked | All picks |
|---|---|---|---|---|---|---|---|---|
