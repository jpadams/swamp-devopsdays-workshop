# Workshop design & rationale

Everything here was validated by an end-to-end dry run on 2026-08-21 against
swamp `20260821.132528.0-sha.a18f55df` (darwin-aarch64). See
[../FINDINGS.md](../FINDINGS.md) for measurements. This document records *why*
the workshop is shaped the way it is, so decisions don't get re-litigated.

## The thesis

> Agents don't have to **be** your automation. They can **author** your
> automation.

The transition being taught:

```
PROMPT → AGENT IMPROVISATION → TYPED OPERATIONS → WORKFLOW → RUNBOOK → GIT
```

For a DevOps audience this connects agentic AI to things they already believe in:
declarative config, reproducibility, review, version control, least surprise, and
separating control-plane decisions from execution.

## Decisions, and why

### A fake HTTP control plane, not docker-compose

Rejected: 5–10 imperfect services in `docker compose`. Rejected: LocalStack,
minikube, real AWS.

Chosen: a single-file fake cloud API (`controlplane/server.ts`).

Reasons:

1. **It's the paved path.** Swamp's own first tutorial is an HTTP checker model.
   A docker-compose environment forces the agent to author TS models that shell
   out to `docker`, which is harder to write and teaches less.
2. **It removes Docker from the prereq list entirely** — no Docker Desktop
   licensing, no ARM/x86 image problems, no disk-space failures across a room of
   corporate laptops.
3. **Identical on macOS, Linux, and Windows.**
4. It runs on **swamp's own bundled Deno**, so there is no runtime prerequisite
   at all. (Verified: `~/.swamp/deno/deno`, auto-downloaded on first extension
   load.)

Docker extensions *do* exist in the Swamp registry (`@keeb/docker`,
`@smith/docker-compose`, `@swamp/container-image`) — compose was possible, just
off-path.

### The payoff is a diff, but the *lesson* is where the guard reads from

The original plan's centerpiece was "add remediation that skips
production-critical, then `git diff`." That works, and the diff is good.

But the dry run found something better. There are two ways to write that guard:

| Guard source | On `incident-3` (control plane drops tier labels) |
| --- | --- |
| `attributes.tier` — from the live API | **restarts payments-api AND checkout-api** |
| `tags.tier` — from the definition YAML in git | **restarts nothing** |

The first version passed every test, because the API happened to report the right
label. It is also the version most agents will write, because the tier is right
there in the API response.

`incident-3` exists solely to break it. The takeaway —

> Your safety check must live in the artifact you review, not in the system
> you're reviewing it against.

— is a better SRE lesson than anything about Swamp, and it's the reason
Exercise 6 exists.

### Assertions must cover every service

Non-obvious and easy to get wrong. If the audit only asserts on the service you
know is broken, then injecting the incident produces **the same failures as
baseline**, and Exercise 4 — the emotional centerpiece — lands as a shrug.

With per-service `forEach` assertions it reads:

```
baseline:          Assertions: 13 passed,  5 failed
after incident-2:  Assertions:  9 passed,  9 failed
                   ✗ all-services-running-catalog-api
                   ✗ all-services-healthy-payments-api
                   ✗ memory-within-limit-payments-api
```

Participant instructions call this out explicitly (Exercise 3). Facilitators
should check for it while circulating.

### A reachability precheck is mandatory

`data.latest` returns the last good value. So when the control plane is **down**,
the audit steps fail but the assertions read *stale data from previous runs* and
report plausible-looking failures — indistinguishable from real seeded problems.
Someone will debug a perfectly good runbook for fifteen minutes.

The reference solution has a `ping` method and a `precheck` job that every other
job depends on. A dead environment now fails in 40ms with a message naming the
fix. This is also a genuine lesson worth saying out loud.

### BYO agent is *permitted*, not *supported*

Swamp ships first-class skills for Claude Code, Cursor, OpenCode, and Codex, and
`swamp repo init --tool <x>` sets up the right instructions. So BYO works.

But you cannot debug four agents at once from the front of a room. Claude Code is
the paved path (it's the `repo init` default); others are welcome but
self-supported. The "do different agents converge on the same artifact?"
comparison is a **closing slide**, not a live exercise.

### Exercise 4 cannot run on an honor system

Both the Exercise 1 gag ("now reproduce it") and the Exercise 4 payoff ("don't
ask your agent") depend on people voluntarily not using the tool they just got
excited about. A meaningful fraction will just re-prompt and miss the point.

Mitigations, in order of preference: run Exercise 4 from the stage first; ask the
room to physically close their agent; pair people so there's a witness.

### Say "deterministic" carefully

Workflows are deterministic in *structure*, but shell steps are still shell
steps, and the registry ships a `CLI Agent` extension that invokes coding agents
*from inside* workflows. Before a room of SREs, the framing that survives Q&A:

> The decision-making is frozen into reviewable code. Execution is as
> deterministic as your scripts are.

## Schedule (2h)

Install and init are **pre-work**, not agenda items.

| Time | Segment | Notes |
| ---: | --- | --- |
| 0–10 | What happens when we let agents operate infrastructure? | Framing. No laptops. |
| 10–25 | **Ex 1** — agent freestyles, then kill the session | The "reproduce it" gag |
| 25–50 | **Ex 2** — model the environment | Riskiest segment; see below |
| 50–75 | **Ex 3** — build the audit runbook | Watch for single-service assertions |
| 75–90 | **Ex 4** — incident, rerun runbook | Run from stage first |
| 90–110 | **Ex 5** — guarded remediation | Guard polarity will trip people |
| 110–120 | **Ex 6** — `git diff` + `incident-3` reveal | The real ending |

Slack: there is almost none. Cut Ex 6's diff discussion first if you're behind;
cut Ex 1's reproduce-it gag second (it can be made as a 3-minute slide).

**Exercise 2 is the segment that decides whether this works.** If cold agents
can't produce a working model in ~25 minutes, the fix is not more time — it's
seeding the repo with `docs/seed/example_echo.ts` so the agent *extends* a
working model instead of authoring one from scratch. That lever is prepared and
ready to pull. See [COLD-AGENT-TEST.md](COLD-AGENT-TEST.md) — this is the one
number nobody has measured yet.

## What was rejected

- **Docker / docker-compose environment** — off-path, heavy prereqs (above).
- **LocalStack / minikube / real AWS** — complexity that teaches nothing about
  Swamp; needs accounts, credits, IAM, and good wifi.
- **Requiring Deno** — unnecessary; swamp bundles its own.
- **Live cross-agent comparison** — unsupportable in a room; make it a slide.
- **Publishing the extension to the registry** — interesting, but it needs auth
  and a collective name, and it's not the lesson. Out of scope.
