# From Agent Prompt to Production Runbook

Six exercises. Each one gives you a **prompt to paste into your coding agent**,
verbatim, plus how to tell when you're done.

You are operating a small fictional cloud. It has five services and a control
plane API at `http://127.0.0.1:8099`. Some things about it are wrong.

Before you start, make yourself a workspace. From the resources repo you cloned:

```bash
./mkworkspace ~/my-workshop    # sets it up and runs preflight for you
cd ~/my-workshop
```

Then, **from `~/my-workshop`** — not from the repo you cloned:

```bash
./preflight              # must pass
./controlplane/start &   # leave this running in its own terminal
```

Every preflight check is about the directory you run it in, and it prints that
directory in its header. If it says `checking:` anything other than your own
workspace, you are about to validate the wrong folder. Work here, commit here:
`git add -A && git commit -m checkpoint` after each exercise gives you something
to go back to, and gives Exercise 6 something to read.

---

## Exercise 1 — Let the agent freestyle (15 min)

Paste this into your agent exactly as written. It is deliberately vague.

> There is a cloud control plane API running at http://127.0.0.1:8099. Figure
> out what's wrong with this environment and tell me what needs attention.

Let it work. Poke at it. Ask follow-ups. Get a real answer you'd be willing to
put in a Slack channel.

**Then do this, and take it seriously:**

1. Write down what the agent concluded — the actual list of problems.
2. **Quit your agent. Close the session. Clear the context. Really.**
3. Now, without starting it again, reproduce exactly what it did to find those
   problems. Every request, in order, with the same arguments.

Most people cannot. That gap is the entire point of the next five exercises.

> **Done when:** you have a list of findings and an uncomfortable feeling about
> step 3.

---

## Exercise 2 — Teach Swamp about your services (25 min)

Now make the investigation something a machine can repeat.

> I want to use Swamp to model this environment instead of poking at it with
> curl. Create a Swamp model type for a single service in the control plane at
> http://127.0.0.1:8099, with a method that fetches that service's live state,
> compares it to the desired state the control plane publishes, and records what
> it found. Then create a definition for each of the five services.
>
> Read the swamp skill first. The model type is TypeScript in
> `extensions/models/`; the definitions are YAML created with `swamp model create`.

Things worth telling your agent if it stalls:

- `swamp model type search --json` confirms your type was discovered.
  (Keep `--json`; without it the command opens an interactive picker and hangs.)
- `~/.swamp/deno/deno check extensions/models/<yourfile>.ts` type-checks it.
  Run this *before* running the model. It catches most mistakes.
- Definitions carry a `tags:` block. Put the service's tier in it — you'll want
  it in Exercise 5. The control plane tells you each service's tier.

**Verify it works:**

```bash
swamp model @<your-type> method run <your-method> checkout-api
```

> **Done when:** one command audits one service and stores structured data.
> `swamp data list checkout-api` shows a resource.

---

## Exercise 3 — Build the runbook (25 min)

One service at a time isn't a runbook.

> Now create a Swamp workflow that audits all five services in parallel, then
> asserts the things I care about: every service is running, every service is
> healthy, nobody is over a memory limit, nothing has drifted from desired
> state, and every service has an owner. Assert each service separately, so a
> failure tells me which service broke. Validate it before running it.

Two things that will save you:

- `swamp workflow validate <name>` before every run. It catches DAG and
  expression errors in milliseconds.
- **One assertion per service per invariant — not one assertion that ANDs all
  five services together.** Cover every service, and give each its own
  assertion so a failure names the service. Two ways to get this wrong, and
  the second one is the sneaky one:
  - Checking only the service you know is broken. Exercise 4 then looks
    identical to Exercise 3.
  - Checking all five, but ANDed into one assertion per invariant. This *looks*
    like full coverage and isn't: `every-service-healthy` is already red at
    baseline (checkout-api is unhealthy by design) and it just **stays** red
    when Exercise 4 breaks two more services. Measured — a cold agent that
    ANDed them moved from 4 failures to 5 when the incident hit; the
    per-service version moves from 5 to 9.

**Verify it works:**

```bash
swamp workflow run <your-workflow>
```

You should see parallel steps, then a count like `Assertions: N passed, M failed`.

Sanity-check the total, not just the failures: asserting per service lands near
`13 passed, 5 failed`. A much smaller total — say `1 passed, 4 failed` — means
you ANDed services together into one assertion per invariant. Go split them
before Exercise 4, or the incident won't show up.

> **Done when:** one command audits the whole environment and tells you what's
> wrong. Write down the pass/fail numbers.

---

## Exercise 4 — Incident (15 min)

Your facilitator will now break the environment. (Or break it yourself:
`curl -X POST http://127.0.0.1:8099/admin/scenario/incident-2`)

**Do not ask your agent what happened. Do not open your agent at all.**

Run your runbook:

```bash
swamp workflow run <your-workflow>
```

Compare the pass/fail numbers to what you wrote down in Exercise 3.

> **Done when:** your runbook told you what changed, and no agent was involved.
>
> This is the moment the workshop exists for. An AI authored this procedure.
> An AI is not required to execute it.

---

## Exercise 5 — Guarded remediation (20 min)

Auditing is safe. Acting is not.

> Add a workflow that restarts unhealthy services — but it must never touch
> anything tagged production-critical. Use a step guard, not a filter in the
> model.

Two warnings, both of which will bite you:

1. **A truthy guard SKIPS the step.** This is backwards from every CI `if:`
   you've used. Write the condition for when you want to *skip*.
2. **Where does your guard read "production-critical" from?** If the answer is
   "the control plane's API response," stop and think about it. You are asking
   the system you're policing whether you're allowed to touch it.

**Verify it works:**

```bash
curl -X POST http://127.0.0.1:8099/admin/reset
curl -X POST http://127.0.0.1:8099/admin/scenario/incident-2
swamp workflow run <your-remediation-workflow>
curl -s http://127.0.0.1:8099/admin/restart-log   # ground truth
```

After `incident-2`, three services are unhealthy — two of them are
production-critical. The restart log should contain **exactly one entry**.

> **Done when:** the restart log has one entry, and Swamp printed
> `skipped (guarded)` for the services it refused to touch.

---

## Exercise 6 — Review it like code (15 min)

```bash
git diff
git status
```

That diff is your operational procedure. Read it the way you'd read a
colleague's PR.

Then the real test of Exercise 5:

```bash
curl -X POST http://127.0.0.1:8099/admin/reset
curl -X POST http://127.0.0.1:8099/admin/scenario/incident-3
swamp workflow run <your-remediation-workflow>
curl -s http://127.0.0.1:8099/admin/restart-log
```

`incident-3` makes the control plane stop reporting tier labels — exactly what a
misconfigured or compromised control plane would do.

- If your guard read the tier from the **API**, you just restarted production.
- If it read the tier from your **definition YAML in git**, nothing happened.

Same workflow. Same guard. One word different. That's the difference between
automation you can review and automation you can only hope about.

> **Done when:** you know which one you wrote, and why it matters.

---

## Reference

Endpoints:

```
GET  /services                      all five services
GET  /services/:id                  one service
POST /services/:id/restart          restart it
GET  /desired-state                 what SHOULD be running
GET  /alerts                        pre-computed problems
POST /admin/reset                   back to baseline, no incident
POST /admin/scenario/incident-2     the incident (rewinds to baseline first)
POST /admin/scenario/incident-3     control plane loses its tier labels (ditto)
GET  /admin/restart-log             ground truth: what got restarted
```

Useful commands:

```bash
swamp model type search --json                # is my type registered?
swamp model create <type> <name>              # new definition
swamp model @<type> method run <method> <n>   # run one method
swamp workflow validate <name>                # ALWAYS before running
swamp workflow run <name>
swamp data list <name>                        # versions for one model
swamp data query 'attributes.ok == false'     # predicate only, no model name
~/.swamp/deno/deno check <file.ts>            # type-check your model
```

Stuck? Every exercise has a catch-up you can copy in:

```bash
# from the resources repo you cloned, pointing at your workspace:
./catchup 2 ~/my-workshop     # or 3, or 5 for the complete reference
```
