# Welcome

You're going to take a vague request, let an AI agent improvise a solution, and
then convert that improvisation into an operational procedure you can review,
version, and re-run without the agent.

## What you need

- `git`
- `swamp` — `curl -fsSL https://swamp-club.com/install.sh | sh`
- One coding agent: **Claude Code**, Cursor, OpenCode, or Codex

That's it. **No Docker, no Node, no Python, no Deno, no cloud account.**
Swamp ships its own runtime and we use it to run everything.

## Setup

```bash
git clone <this repo> && cd swamp-devopsdays-workshop
./mkworkspace ~/my-workshop     # must end with "Preflight passed"
cd ~/my-workshop                # work here, not in the clone
```

You don't work in the repo you cloned. It carries the reference solution and the
facilitator notes, and a coding agent pointed at it will read them — which would
hand you the answers to the exercises. `mkworkspace` copies over just the
fictional cloud, `preflight`, and the exercises, gives you a fresh git repo to
checkpoint into, and runs preflight for you. Running `./preflight` inside the
clone deliberately fails and tells you this.

`./preflight` downloads about 165MB the first time. **Do it before you get to
the venue.** Conference wifi is not your friend.

Then, in a terminal you can leave alone:

```bash
./controlplane/start
```

That's your fictional cloud. Check it's alive:

```bash
curl -s http://127.0.0.1:8099/services
```

## Then

Open [EXERCISES.md](EXERCISES.md) and start at Exercise 1.

## The one rule

In Exercise 4, you will be told not to use your agent. Please actually don't.
The workshop has exactly one surprise in it and that's where it lives.
