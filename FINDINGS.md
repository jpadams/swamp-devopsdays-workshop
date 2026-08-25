# Dry run findings — laptop-runnable Swamp workshop

Ran the whole arc end to end on 2026-08-21 against swamp
`20260821.132528.0-sha.a18f55df` (darwin-aarch64). Everything below was
executed, not inferred.

## Verdict

The plan works. The mechanical path is faster and more reliable than the plan
assumes; the risk is entirely in agent variance, network, and facilitation —
not in Swamp.

## Measured timings

| Step | Time |
| --- | --- |
| Binary download (80MB) + extract | ~20s |
| `swamp repo init` | <1s |
| First `model type search` (triggers lazy 85MB deno download + bundle) | 3.2s |
| Single `audit` method run | 11–13ms |
| `infra-audit` workflow, 5 services in parallel + 18 assertions | ~80ms |
| `remediate` workflow (re-audit + guarded restarts) | ~103ms |
| Install → working audited environment (knowing the answer) | ~6 min |

Participant-authored artifact: **~365 lines** — model type ~170, definitions 60,
workflows ~135. (The repo totals ~640 lines, but `controlplane/server.ts` and
`CLAUDE.md` are provided by you, not authored in the room. Quote the smaller
number on the slide; it's the honest one and still a good number.)

## Resolved: the three open questions

**1. No Deno prerequisite.** Swamp downloads its own Deno to `~/.swamp/deno/deno`
(2.8.3, 85MB) on first extension load. Verified by running a model method under
`env -i PATH=/usr/bin:/bin` with system Deno absent — worked.

**2. The tag guard is expressible.** This is the workshop's centerpiece and it
works. Definition-level `tags:` auto-propagate into data tags, and a step guard
can read them via `data.latest(self.svc, "audit").tags.tier`. With payments-api
and checkout-api both *unhealthy* **and** `tier: production-critical`, and
catalog-api unhealthy and `tier: standard`, the remediation workflow restarted
**only catalog-api** — confirmed against the control plane's own restart log.
Swamp prints the guard expression next to each skipped step, which is a better
demo artifact than the diff.

**Where the guard reads its safety label from is the whole lesson.** My first
version sourced `tier` from the live API response (`attributes.tier`) — i.e. the
runbook asked the system it was policing whether it was allowed to touch it. It
passed every test, because the API happened to report the right label. Sourcing
it from the definition YAML in git (`tags.tier`) is a one-word change and a
completely different safety property. `incident-3` exists to prove it:

| Guard source | incident-3: control plane drops all tier labels |
| --- | --- |
| `attributes.tier` — from the API | **restarted payments-api AND checkout-api** |
| `tags.tier` — from definition YAML in git | **zero restarts** |

Teach the second one, and use the first as the mistake. "Your safety check must
live in the artifact you review, not in the system you're reviewing it against"
is a better takeaway for an SRE audience than anything about Swamp.

**3. Zero runtime prerequisites.** `./controlplane/start` runs the fake cloud on
swamp's *bundled* Deno. Final prereq list is **git + swamp + a coding agent**.
No Docker, Node, Python, or Deno.

## Things that will bite you

- **Participants must not work in this repo — enforced, as of 2026-08-23.** The
  working tree carries `FINDINGS.md`, `docs/FACILITATOR.md`,
  `docs/WORKSHOP-DESIGN.md`, `docs/COLD-AGENT-TEST.md` and `docs/seed/`, all of
  which name the model type, the workflow, the assertion design and the
  `tags.tier` guard; the solution branches are one `git show` away, offline. An
  agent asked to author the artifact orients by reading the repo root, so
  working in the clone hands over the answers and makes any measured timing
  meaningless. The only reason the cold run produced usable data is that it
  happened in `/tmp/cold-test`.

  The default branch is now `resources` to say so in the shell prompt, and
  `./preflight` **hard-fails** in this repo (exit 1) unless given
  `--resources`. Crucially the detection is by git refs and by facilitator-doc
  filenames, never by branch name — a name check is defeated by
  `git checkout -b main`, by a single-branch clone, and by any future rename.
  Verified: fails in the repo, fails in a clone re-checked-out as `main`, passes
  in a fresh workspace.

  Participants run `./mkworkspace <path>`, which copies over only
  `controlplane/`, `preflight` and `participant/EXERCISES.md`, runs
  `swamp repo init` and `git init`, commits, and runs preflight in the new
  directory. Catch-up is `./catchup <N> <workspace>` — a copy from a solution
  branch rather than a checkout, so the participant keeps their own git history
  and their checkpoints survive. End-to-end verified in a fresh workspace:
  `13 passed, 5 failed` at baseline, `9 passed, 9 failed` after incident-2,
  exactly one restart from `remediate`, zero under incident-3.

  Two traps this closes that were live before: preflight validated whatever
  directory it ran in while the docs said "from the repo root", so a green
  preflight could describe a directory you weren't working in; and the copy list
  in the cold protocol omitted `preflight` itself, leaving no way to check the
  workspace at all.

- **Scenario injection used to be append-only — fixed 2026-08-22.** Two bugs,
  both of which only appeared on the *second* pass through the demo, i.e. on
  stage. (1) `restartLog` accumulated, so a re-run of the incident-2 →
  remediate sequence reported two restarts and the "exactly one restart" payoff
  stopped landing. (2) Scenarios mutated whatever state was already there
  instead of starting clean, so running `incident-3` (which wipes tier labels)
  before `incident-2` left the labels missing — quietly changing how the
  Exercise 6 guard-sourcing reveal behaves. `POST /admin/scenario/:name` now
  rewinds to `baseline()` and clears `restartLog` before applying the incident.
  Verified: two back-to-back rehearsals with no reset both report exactly one
  restart, and `incident-3` → `incident-2` restores all five tag sets.
  `POST /admin/reset` is still there for ending on a clean baseline.

- **Every `swamp ... search` command hangs forever when stdin is a terminal.**
  Verified 2026-08-22 on swamp `20260823.004821.0-sha.57798752`. With a tty on
  stdin these commands open a full-screen fuzzy-picker TUI (alt-screen,
  `search:` box, `↑/↓ navigate  Enter select  Esc cancel`) and block. A query
  argument does *not* avoid it — it only pre-fills the search box. All four
  measured under a pty:

  | invocation | tty stdin | result |
  | --- | --- | --- |
  | `swamp model type search` | yes | hung, killed at 20s |
  | `swamp model type search shell` | yes | hung, killed at 20s |
  | `swamp extension search aws` | yes | hung, killed at 15s |
  | `swamp model search` | yes | hung, killed at 15s |
  | `swamp workflow search` | yes | hung, killed at 12s |
  | `swamp model type search --json` | yes | exited 1.4s, JSON |
  | `swamp model type search` | no (`< /dev/null`) | exited 1.2s, JSON |

  Treat it as a property of the `search` verb, not of one command. Note that
  `swamp extension search` is step (a) of CLAUDE.md rule 1 and `swamp model
  search` is the Getting Started command — both run *before* anything else, so
  the `--json` already on the latter is load-bearing, not incidental.

  This wrecked `./preflight`, which ran the command with `>/dev/null 2>&1` — so
  the picker's escape sequences went to `/dev/null` while it kept reading the
  keyboard, giving a silent hang at "warming extension runtime" with no output
  and ~0 CPU. It looks *exactly* like a stalled 85MB download on bad wifi, which
  is the worst possible misdiagnosis to hand a room of 40 people.

  Fix applied: `--json` (swamp's documented non-interactive flag) on every
  invocation, plus `exec 0</dev/null` at the top of `preflight`, plus `--json`
  added to every place in the docs that hands a human a `search` command to
  type. Agents are unaffected — a coding agent's Bash tool gives no tty, so it
  gets JSON either way. **This is a humans-at-a-terminal trap only**, though
  some agent harnesses do allocate a pty, so the docs carry `--json` regardless.

  **Possible two-day regression — confirm before workshop day.** The timings
  table above records `First model type search … 3.2s` from the 2026-08-21 dry
  run against `20260821.132528.0`. If that was measured at a terminal, the
  picker did not exist then and this appeared between the two builds. Either
  way, attendees install whatever is current on the day: **re-run `./preflight`
  against the day's build** rather than trusting this result. Worth filing
  upstream as a regression.

- **Lazy 85MB Deno download happens mid-workshop**, at first extension load —
  the worst possible moment on conference wifi. `./preflight` warms it. This is
  the single highest-value pre-work item.
- **~165MB per attendee** (80MB binary + 85MB deno), before agent traffic.
- **`swamp repo init` writes to `~/.claude/skills/` globally**, not just the
  repo. Surprising on a shared or managed laptop; mention it.
- **Unauthenticated users are rate-limited.** The CLI nags that `swamp auth login`
  gives "higher rate limits", and data is tagged `initiatedBy: ghost`. 40
  attendees behind one conference NAT is exactly the shape that trips per-IP
  limits. Test this at the venue, or have attendees sign up beforehand.
- **`.swamp/` is gitignored**, so run data is not part of the git-diff payoff.
  Fine — but the payoff is models/definitions/workflows, not results.
- **Doc bug in the bundled skill**: its command table says
  `swamp data query <name> '<pred>'`; the real CLI takes the predicate only
  (`swamp data query 'attributes.ok == false'`). Agents following the skill will
  hit a usage error. Warn them or patch the skill.
- **Only four task types** — `model_method`, `workflow`, `manual_approval`,
  `assert`. There is no shell *task*; shell is the built-in `command/shell`
  *model*. Agents guess wrong here.
- **Cosmetic**: forEach steps render as `restart-${{ self.svc }}[2]` in the
  gutter rather than the expanded name, and `swamp data query --log` printed
  empty table rows (`2 results` but blank cells). Neither blocks anything;
  both look sloppy on a projector. Use `--json` on stage.

## Design flaw the dry run caught

My first version of `infra-audit` asserted only on checkout-api. After injecting
`incident-2`, the rerun printed **exactly the same three failures** as the
baseline — the "run your runbook, no agent needed" moment landed as a shrug.

Fixed by adding per-service `forEach` assertions (`forEach` works on `assert`
steps). Now the incident reads:

```
baseline:          Assertions: 13 passed,  5 failed
after incident-2:  Assertions:  9 passed,  9 failed
                   ✗ all-services-running-catalog-api
                   ✗ all-services-healthy-payments-api
                   ✗ memory-within-limit-payments-api
```

**Write the assertions so the incident changes the output.** Otherwise the
payoff is invisible. This is the easiest thing in the whole workshop to get
wrong and the most expensive to get wrong.

## A trap worth defusing before the room finds it

With the control plane **down**, the audit workflow did not say so. The audit
steps failed (they carry `allowFailure: true`), the assertions then read
**stale `data.latest` values from earlier runs**, and the run reported
`12 passed, 6 failed` — indistinguishable from real seeded problems. Someone
would have debugged a perfectly good runbook for fifteen minutes.

Fixed with a `ping` method plus a `precheck` job that every other job depends on
(`condition: succeeded`). Now a dead environment fails in 40ms with:

```
control plane unreachable at http://127.0.0.1:8099 —
start it with ./controlplane/start (… Connection refused (os error 61))
```

This is also a real lesson worth stating out loud: `data.latest` returns the last
good value, so an audit that can't reach anything looks like an audit that found
problems. Put a reachability assert at the top of any real runbook.

## Error legibility (checked, because 40 people will hit it)

- **Runtime error** in a model → one clean line:
  `Error: svcRes.jsonn is not a function`. No bundler wall. Good.
- **`~/.swamp/deno/deno check <file>`** → precise TS error, line number, and a
  "Did you mean 'json'?" suggestion. Tell participants to run it; agents skip it.
  Note it downloads zod from npm on first use — one more thing `./preflight`
  should warm.

## Unexpected gift: `manual_approval`

There is a `manual_approval` task type that suspends the workflow to disk and
waits for `swamp workflow approve <wf> <step>`. For a DevOps audience,
"the agent wrote the runbook, and the runbook still stops and asks a human
before touching production" is a stronger ending than the guard alone. Consider
replacing or augmenting the guard exercise with it.

## Recommended prereq email

```
Required (do this BEFORE the workshop, on real wifi):
  1. curl -fsSL https://swamp-club.com/install.sh | sh
  2. one coding agent: Claude Code / Cursor / OpenCode / Codex
  3. git clone <workshop repo> && cd <repo> && ./mkworkspace ~/my-workshop
     ^ this downloads ~165MB and must end with "Preflight passed"
       (you work in ~/my-workshop, not in the clone)

Not required: Docker, Node, Python, Deno, an AWS account, kubectl.
```

## Still unverified — and one of them is the premise

**The number that matters most does not exist yet.** Every timing above is me
writing this by hand after reading the API reference directly. The workshop's
actual premise is that a *participant's agent, cold, from a prompt* produces
this. Nobody has measured that, and the entire schedule depends on it.

Run exactly one experiment before committing to the agenda:

> Fresh empty dir. `swamp repo init`. Control plane running. Hand a colleague's
> Claude Code **only the participant-facing prompt** and nothing else. Wall-clock
> timer. No intervention. Record time-to-first-successful-`workflow run`, and
> where it got stuck.

If that comes in over ~25 minutes, the fix is **not** more time — it's seeding
the repo with a trivial working model (an `echo`-style type) that the agent
*extends* rather than authors from scratch. That converts the hardest step into
the easiest one and is the difference between a workshop that lands and a room
of people watching a spinner.

Also still open:

- **Fully offline behaviour** — couldn't airgap here. There's a telemetry
  subsystem and a `--no-telemetry` flag; confirm a `workflow run` needs no
  network at all.
- **Venue-scale rate limits** — 40 unauthenticated attendees behind one NAT.
  Data is tagged `initiatedBy: ghost` and the CLI advertises higher limits for
  signed-in users. Test at the venue or have people sign up beforehand.
- **Cross-agent convergence** — only Claude Code's skill path was exercised.
  Keep the Cursor/Codex/OpenCode comparison as a closing slide, not a live
  exercise.
