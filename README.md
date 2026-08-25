# From Agent Prompt to Production Runbook

A laptop-runnable DevOpsDays workshop on using a coding agent to **author**
operational automation rather than **be** it, built on
[Swamp](https://github.com/swamp-club/swamp).

**Status:** validated end to end. Ready to run, with one open question — see
[Next steps](#next-steps).

---

## Start here if you're picking this up cold

Read in this order:

1. **[docs/WORKSHOP-DESIGN.md](docs/WORKSHOP-DESIGN.md)** — the thesis, the arc,
   every design decision and why, plus what was rejected.
2. **[FINDINGS.md](FINDINGS.md)** — measurements and verified Swamp behaviour
   from the dry run. The non-obvious facts that cost real time to discover.
3. **[docs/FACILITATOR.md](docs/FACILITATOR.md)** — minute-by-minute run of show.
4. **[docs/COLD-AGENT-TEST.md](docs/COLD-AGENT-TEST.md)** — **the one experiment
   still outstanding.** Do this before committing to the agenda.
5. **[participant/EXERCISES.md](participant/EXERCISES.md)** — what attendees get.

## What the workshop does

Participants run a small fictional cloud on their laptop, let an agent freestyle
against it, then convert that improvisation into a Swamp model + workflows they
can review in git and re-run without the agent. An injected incident proves the
runbook works without the agent. A second incident proves *where a safety check
reads its data from* is the whole ballgame.

## Repo layout

```
controlplane/server.ts     the fake cloud: 5 services, 5 seeded problems,
                           injectable incidents. Single file, no deps.
controlplane/start         runs it on swamp's OWN bundled deno
preflight                  attendee readiness check; warms the 165MB of
                           lazy downloads. THE critical pre-work artifact.
participant/               what attendees read
docs/                      design, facilitation, prereq email, test protocol
docs/seed/example_echo.ts  fallback lever if Exercise 2 runs long (verified)
FINDINGS.md                dry-run measurements and gotchas
```

## This repo is a supply depot, not a workspace

Nobody works **in** here. The default branch is called `resources` to say so out
loud, and `./preflight` hard-fails if you run it in this directory — because
this repo carries the solution branches and the facilitator notes, and a coding
agent asked to author the artifact *will* read them. That would quietly hand
your participants the answers and make any timing you measure meaningless.

Everyone — you included — works in a workspace of their own instead. You run
this for yourself; there is no classroom to provision:

```bash
git clone <this repo> && cd swamp-devopsdays-workshop
./mkworkspace ~/my-workshop    # copies in only what can't be regenerated,
                               # git inits it, and runs preflight there
cd ~/my-workshop
```

What crosses over: `controlplane/`, `preflight`, `participant/EXERCISES.md`.
What stays behind: every solution branch, `FINDINGS.md`, and all of `docs/`.

## Branches

| Branch | Contains | Role |
| --- | --- | --- |
| `resources` | environment, docs, `mkworkspace`, `catchup` | default; copy **from** here |
| `solution-2` | model type + 5 tagged definitions | catch-up source for Exercise 2 |
| `solution-3` | + `infra-audit` workflow | catch-up source for Exercise 3 |
| `solution` | + guarded `remediate` workflow | complete reference |

Falling behind is a copy, not a checkout — so a participant keeps their own git
history and their checkpoints survive:

```bash
./catchup 3 ~/my-workshop      # now holds everything Exercise 3 produces
```

## Run it yourself in two minutes

Facilitators can drive the reference straight from a solution branch here —
`--resources` is how you tell preflight you meant to:

```bash
./preflight --resources         # must pass; downloads ~165MB first time
./controlplane/start &          # the fictional cloud, port 8099

git checkout solution           # the complete reference

swamp workflow run infra-audit                              # 13 passed, 5 failed
curl -X POST localhost:8099/admin/scenario/incident-2
swamp workflow run infra-audit                              #  9 passed, 9 failed
swamp workflow run remediate
curl -s localhost:8099/admin/restart-log                    # exactly one restart

# the ending: control plane loses its tier labels
curl -X POST localhost:8099/admin/scenario/incident-3
swamp workflow run remediate
curl -s localhost:8099/admin/restart-log                    # empty. guard held.
```

Injecting a scenario rewinds the control plane to baseline and clears the
restart log first, so the whole sequence above is re-runnable as many times as
you like and the restart counts always read the same. Use `POST /admin/reset`
only to end on a clean baseline with no incident applied.

## Prerequisites

**git + swamp + one coding agent.** That's all — no Docker, Node, Python, Deno,
or cloud account. Swamp bundles its own runtime and the fake cloud runs on it.

Attendee email ready to send: [docs/PREREQ-EMAIL.md](docs/PREREQ-EMAIL.md).

## Next steps

1. **Run the cold-agent test.** [docs/COLD-AGENT-TEST.md](docs/COLD-AGENT-TEST.md).
   Every timing in FINDINGS.md is from hand-writing the solution while reading
   the API reference — *not* from an agent working cold from the Exercise 2
   prompt. Exercise 2 is budgeted at 25 minutes on faith. This test tells you
   whether to ship as-is, pull the seed lever, or restructure.
2. **Verify fully-offline operation.** Untested. Changes the venue risk profile.
3. **Test venue-scale rate limits.** 40 unauthenticated attendees behind one NAT;
   the CLI advertises higher limits for signed-in users and tags data
   `initiatedBy: ghost`.
4. **Optionally** run the cold-agent test on Cursor/Codex/OpenCode — it would
   give you real evidence for the "different agents, converging artifacts"
   closing slide.
