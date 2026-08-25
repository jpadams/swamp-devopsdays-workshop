# The one experiment that hasn't been run

**Status: PARTIALLY MEASURED — one run through Exercises 2–3 on 2026-08-22,
artifacts inspected but not timed. See "Run 1" below. Timings still needed.**

## Why this matters

Every timing in [../FINDINGS.md](../FINDINGS.md) comes from writing the
reference solution *by hand, after reading Swamp's API reference directly*. That
took about 6 minutes of mechanical work.

That number is not the workshop. The workshop's premise is that a **participant's
agent, cold, from a prompt** produces the same thing. Nobody has measured that,
and the whole schedule depends on it — Exercise 2 is budgeted at 25 minutes on
faith.

## Protocol

Be strict about this. A sloppy run gives you a number you can't act on.

1. **A workspace outside this repo**, which `mkworkspace` builds for you —
   copying in `controlplane/`, `preflight`, and the exercises, `git init`-ing
   it, committing, and running preflight there:
   ```bash
   ./mkworkspace /tmp/cold-test
   cd /tmp/cold-test
   ```
   This replaces the old hand-rolled setup, which was easy to get wrong in two
   ways that both corrupt the result: forgetting `git init` (Exercise 6 reads
   `git diff` and has nothing to show), and forgetting to copy `preflight`
   (so the only preflight available is the resources repo's, which reports
   *that* directory's state and passes while telling you nothing).
2. **Control plane running**, from inside the workspace:
   ```bash
   ./controlplane/start &
   ```
3. **A colleague, not you.** Someone who hasn't read the reference solution.
   Ideally someone representative of your audience.
4. **Hand them only the Exercise 2 prompt.** Verbatim, from
   `participant/EXERCISES.md`. Nothing else. No hints, no reference solution, no
   "oh you'll want to…".
5. **Wall-clock timer. No intervention.** Even when it's painful. Especially
   when it's painful — that's the data.
6. **Stop at 40 minutes** even if unfinished. An unfinished run is a valid and
   very informative result.

## Record

| Field | Value |
| --- | --- |
| Date | |
| Agent + model | |
| Person | |
| Time to type discovered (`swamp model type search --json` shows it) | |
| Time to first successful `method run` | |
| Time to five working definitions | |
| **Time to first successful `workflow run`** (the number that matters) | |
| Did they add `tags:` to definitions unprompted? | |
| Did they run `deno check` unprompted? | |
| Where did they get stuck, and for how long? | |
| Did they read the swamp skill, or guess? | |

Also save the transcript. Where the agent went wrong is more actionable than the
total.

## Acting on the result

| Result | What to do |
| --- | --- |
| **Under 15 min** | Exercise 2 is over-budgeted. Give time back to Ex 5 and 6, which are tight. |
| **15–25 min** | Schedule is right as written. Ship it. |
| **25–40 min** | **Pull the seed lever.** Ship `docs/seed/example_echo.ts` in `extensions/models/` on `main` and reword Exercise 2 to "extend this working model." Re-run this test with the seed in place. |
| **Over 40 / didn't finish** | Restructure: hand out the model type pre-written and make the workshop start at Exercise 3. The lesson survives — authoring the *workflow* is arguably the better lesson anyway. |

## Repeat for other agents if you can

Only Claude Code's skill path has been exercised. If you have access, run the
same protocol with Cursor / Codex / OpenCode. Two reasons:

1. You'll know what BYO-agent participants are actually walking into.
2. The artifacts should converge far more than the raw tool-use trajectories do
   — which is itself a great closing slide, and you'd have real evidence for it.

## Second experiment, much cheaper

Verify Swamp works **fully offline**. Couldn't be tested in the dry run.

```bash
# with wifi off, on a repo whose preflight has already passed:
swamp workflow run infra-audit
```

There's a telemetry subsystem and a `--no-telemetry` flag. If a run needs the
network, that changes the prereq email and your venue risk considerably.

---

## Run 1 — 2026-08-22, Exercises 2–3

Run in `/tmp/cold-test` per the protocol above. **Artifacts inspected directly;
wall-clock times were not captured, so the headline question is still open.**
Fill these in if the run is repeated:

| Field | Value |
| --- | --- |
| Agent + model | *(not recorded)* |
| Time to type discovered | *(not recorded)* |
| Time to first successful `method run` | *(not recorded)* |
| Time to five working definitions | *(not recorded)* |
| **Time to first successful `workflow run`** | *(not recorded)* |

What the agent actually produced — all of it working:

| | Cold agent | Reference |
| --- | --- | --- |
| model type | `extensions/models/controlplane_service.ts` | `cloud_service.ts` |
| type name | `@jeremyadams/controlplane-service` | `@workshop/cloud-service` |
| methods on the type | `check` only | `audit` + `restart` |
| definitions | 5, all working | 5 |
| `tags:` in definitions | **`tags: {}` — empty** | `tier: production-critical` etc. |
| workflow | `audit-controlplane` | `infra-audit` |
| assertions | **5, each ANDing all five services** | 18, one per service per invariant |
| baseline result | `1 passed, 4 failed` | `13 passed, 5 failed` |
| after `incident-2` | `0 passed, 5 failed` (**+1**) | `9 passed, 9 failed` (**+4**) |

### Findings

1. **The aggregate-assertion failure mode is real, and the old wording invited
   it.** The Exercise 3 prompt said "every service is running, every service is
   healthy…" — five collective statements, so five ANDed assertions is a
   faithful reading. The guard rail said "make the assertions cover every
   service", which the agent satisfied. It guarded against under-*coverage*
   while the actual failure was under-*granularity*, which reads as compliant.
   Consequence: `every-service-healthy` is already red at baseline (checkout-api
   is unhealthy by design) and stays red through the incident, so Exercise 4's
   payoff shrinks from +4 failures to +1. Exercise 3 has been reworded, and a
   total-count sanity check added, so a participant can catch this themselves
   before Exercise 4.

2. **`tags: {}` confirms the Exercise 6 setup works as designed.** The agent
   added no tier tags unprompted, so it has nothing in git to source a guard
   from and will naturally read the tier off the API — exactly the path
   `docs/FACILITATOR.md` says not to correct, because it's the setup for the
   Exercise 6 reveal. Good news: the reveal doesn't depend on a lucky agent.

3. **Only the method the exercise asked for.** The type had `check` and no
   `restart`, which is correct scoping — Exercise 5 is where `restart` gets
   added by extending the existing type (CLAUDE.md rule 2). Worth knowing that
   Exercise 5 always starts from a one-method type.

4. **Naming diverges freely, and `preflight` is too specific about it.** The
   agent chose `@jeremyadams/controlplane-service`, so `preflight` reports
   `warn @workshop/cloud-service not found` even though the participant's type
   is perfectly fine. That check should match any discovered `*/…-service`-ish
   type, or be dropped from the participant-facing path.

5. **A scratch directory is not a git repo.** `/tmp/cold-test` had no `.git`, so
   Exercise 6 ("review it like code") has nothing to diff. Add `git init &&
   git add -A && git commit` to the protocol's step 1.
