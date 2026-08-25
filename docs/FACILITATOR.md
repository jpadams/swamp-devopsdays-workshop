# Facilitator run-of-show

Read [WORKSHOP-DESIGN.md](WORKSHOP-DESIGN.md) first for *why*. This is *what to
do*, in order.

## The day before

```bash
git checkout resources
./preflight --resources         # on the venue wifi if you can get in early
./controlplane/start &
curl -s http://127.0.0.1:8099/services | head
```

`--resources` is required here: preflight hard-fails in this repo otherwise, on
purpose, because participants must not work in it. You are the exception.

Confirm the catch-up sources still run:

```bash
for b in solution-2 solution-3 solution; do
  git checkout $b && swamp workflow validate infra-audit 2>/dev/null | tail -1
done
git checkout resources
```

Then rehearse the way an attendee will actually do it — in a workspace of their
own, which is also the only way to see what they see:

```bash
./mkworkspace /tmp/rehearse && cd /tmp/rehearse
# ...and to jump straight to the finished reference:
cd - && ./catchup 5 /tmp/rehearse
```

Have ready:

- A USB stick with the swamp binary for the platform mix in the room (~80MB
  each). Someone will not have run preflight.
- The prereq email already sent (see [PREREQ-EMAIL.md](PREREQ-EMAIL.md)).
- A decision on whether you're pulling the seed lever (see below).

## Setup in the room

Write on the whiteboard and leave it there all session:

```
./controlplane/start            <- leave running
http://127.0.0.1:8099

A TRUTHY GUARD SKIPS THE STEP
swamp workflow validate <name>  <- before every run
```

The guard polarity line will save you a dozen individual conversations.

## 0–10 · Framing

No laptops open. Make the argument, don't demo it:

- We are all about to let agents touch production. Some of us already have.
- The question isn't "can it do the work" — it obviously can.
- The question is: **what exactly did it do, and can you do it again?**

Land the distinction you'll return to at the end: **probabilistic creation vs.
deterministic execution.**

## 10–25 · Exercise 1 — freestyle, then kill it

Turn them loose with the vague prompt. Circulate; don't help. Let them enjoy it —
the agent will do a genuinely good job, and that's the setup.

At ~22 minutes, stop the room and run the gag:

> Write down what your agent found. Now quit it. Close the session. Now
> reproduce exactly what it did — every request, in order.

Give it a full two minutes of squirming. Ask for a show of hands: who can
reproduce it exactly? Then move on. **Do not explain the lesson.** Exercise 4
explains it for you.

## 25–50 · Exercise 2 — model the environment (the risky one)

This is where the workshop is won or lost. Circulate constantly.

Most common failure modes, in the order you'll see them:

| Symptom | Fix |
| --- | --- |
| Agent invents CLI flags | Tell it to read the swamp skill. It's installed. |
| Type not found | `swamp model type search --json` — filename must be in `extensions/models/` |
| Any `swamp ... search` appears to hang | It opened an interactive picker; press Esc. Always pass `--json`. See FINDINGS.md. |
| Cryptic runtime error | `~/.swamp/deno/deno check <file>` — precise TS error |
| Agent writes a `shell` *task* | There isn't one. Shell is the `command/shell` *model*. Four task types only. |
| Agent uses `swamp data query <name> '<pred>'` | The bundled skill's own table is wrong. Predicate only. |
| Everything is "unhealthy" and nothing makes sense | Control plane is down. `./controlplane/start` |

**The seed lever.** If at ~15 minutes into this segment more than a third of the
room has no working model, stop and say:

> Copy `docs/seed/example_echo.ts` into `extensions/models/` and tell your agent
> to extend that instead of starting from scratch.

Don't apologize for it. Extending a working model is a more realistic task than
authoring one anyway.

**Also watch for:** definitions without a `tags:` block. Exercise 5 needs the
tier tag. Nudge people toward it now — it's much more annoying to retrofit later.

## 50–75 · Exercise 3 — the audit runbook

One thing to police, and it matters more than anything else in this segment:

> **Are your assertions covering all five services, or just the broken one?**

If they only assert on checkout-api, Exercise 4 will look identical to Exercise 3
and the payoff evaporates. Ask people directly. Point at the whiteboard.

Have them **write down their pass/fail numbers** before the break. They need it
for comparison in ten minutes.

## 75–90 · Exercise 4 — the incident

**Run this from the stage first.** Do not rely on people voluntarily not opening
their agent.

On your machine, projected:

```bash
curl -X POST http://127.0.0.1:8099/admin/scenario/incident-2
swamp workflow run infra-audit
```

Say it out loud while it runs, and then let the silence sit:

> I did not ask an agent what happened. I ran the procedure the agent wrote.
>
> An AI authored this. An AI is not required to execute it.

Then have them do it. Ask people to close their agent window first — make it a
physical action, not a promise.

Compare numbers: baseline `13 passed, 5 failed` → `9 passed, 9 failed`, with
newly-named failures. If someone's numbers are unchanged, that's the
single-service-assertion problem; have them fix it now, it's fast.

## 90–110 · Exercise 5 — guarded remediation

Two things will happen, and both are useful:

1. **Guard polarity.** People will write the guard backwards and restart
   everything, including production. Point at the whiteboard. Let the mistake
   happen — the restart log makes it obvious and memorable.
2. **Guard sourcing.** Most agents will read the tier from the API response.
   **Do not correct this.** It passes the test. It is the setup for Exercise 6.

Check with the ground truth, not with Swamp's output:

```bash
curl -s http://127.0.0.1:8099/admin/restart-log   # should be exactly one entry
```

## 110–120 · Exercise 6 — review, then the reveal

First, the diff. Let them read their own operational artifact — roughly 365
lines. Frame it:

> Instead of "trust me, the agent knows how to operate our infrastructure," you
> have "here is the operational artifact the agent produced — review it like
> code."

Then the reveal. Project this:

```bash
curl -X POST http://127.0.0.1:8099/admin/scenario/incident-3
swamp workflow run remediate
curl -s http://127.0.0.1:8099/admin/restart-log
```

Rehearse this as often as you like: injecting a scenario rewinds to baseline and
clears the restart log, so restart counts read identically every run-through and
incidents never layer onto each other.

`incident-3` stops the control plane reporting tier labels. Show both versions if
you have time; show the broken one if you don't:

- Guard reading `attributes.tier` (from the API) → **restarts production**
- Guard reading `tags.tier` (from git) → **restarts nothing**

Close on it:

> Your safety check has to live in the artifact you review, not in the system
> you're reviewing it against.
>
> That's not a Swamp lesson. That's just operations.

## If you're running behind

Cut in this order:

1. Exercise 6's diff discussion (keep the `incident-3` reveal — it's the ending)
2. Exercise 1's reproduce-it gag (make it a 3-minute slide instead)
3. Exercise 5's remediation (demo it from the stage rather than having them build it)

Never cut Exercise 4. That's the workshop.

## Resetting between sessions

```bash
curl -X POST http://127.0.0.1:8099/admin/reset
git checkout resources && git clean -fd   # careful: discards uncommitted work
# participants' own workspaces are separate directories and are untouched by this
```
