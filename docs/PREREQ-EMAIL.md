Copy-paste and send ~1 week ahead, then again 24h ahead. The 165MB download is
the single biggest risk to the session and this email is the only mitigation.

---

**Subject: Before our Swamp workshop — 10 minutes of setup, please do it at home**

Hi —

You're booked into *From Agent Prompt to Production Runbook*. The workshop runs
entirely on your laptop; there's no cloud account, no Kubernetes, and nothing to
provision.

But there is a ~165MB download, and conference wifi will not be kind to 40 people
doing it at once. **Please run the setup below before you arrive.**

**1. Install Swamp**

```
curl -fsSL https://swamp-club.com/install.sh | sh
```

**2. Have a coding agent working**

Claude Code, Cursor, OpenCode, or Codex — whichever you already use. Make sure
you can actually run it and that you're signed in with working API access.

Claude Code is the best-supported path for this workshop (it's Swamp's default).
The others work, but you'll be more on your own.

**3. Clone the repo, make yourself a workspace, and let it run preflight**

```
git clone <REPO URL>
cd swamp-devopsdays-workshop
./mkworkspace ~/my-workshop
```

You don't work in the cloned repo — it holds the answers, and your coding agent
would read them. `mkworkspace` sets up a workspace of your own and runs
preflight there for you. It must end with **"Preflight passed."** That step warms every lazy download —
notably Swamp's bundled runtime, which otherwise downloads at the worst possible
moment mid-session.

**You do NOT need:** Docker, Node, Python, Deno, an AWS account, kubectl, or
admin rights.

**A heads-up:** `swamp repo init` installs agent skills into your home directory
(`~/.claude/skills/`), not just the project folder. If you're on a managed
laptop, that's worth knowing in advance.

If preflight fails, reply to this email and we'll sort it out beforehand rather
than burning workshop time on it. Bring a USB port too — I'll have the installer
on a stick for anyone who gets stuck.

See you there,
Jeremy
