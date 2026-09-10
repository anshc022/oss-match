# Contributing to OSS Match

This project exists to help people make their first open source contribution.
It would be strange if contributing here were hard. If any step below is
confusing, that is a bug in this document, and telling us about it is itself a
useful contribution.

You do not need to be an expert. You do not need to ask for permission to start.
Comment on the issue you want, and it is yours.

---

## Table of contents

- [Ways to help](#ways-to-help)
- [Set up your local copy](#set-up-your-local-copy)
- [Run the app](#run-the-app)
- [Making a change](#making-a-change)
- [Branch naming](#branch-naming)
- [Commit messages](#commit-messages)
- [Tests and checks](#tests-and-checks)
- [Opening the pull request](#opening-the-pull-request)
- [What happens next](#what-happens-next)
- [What makes a good first pull request here](#what-makes-a-good-first-pull-request-here)
- [Project layout](#project-layout)
- [Common problems](#common-problems)

---

## Ways to help

Code is one way, not the only one.

- Fix an issue labelled [`good first issue`](https://github.com/anshc022/oss-match/labels/good%20first%20issue).
- Improve documentation, including this file.
- Add a test for behaviour that has none.
- Report a bug you hit, with steps to reproduce.
- Fix an accessibility problem: a missing label, a focus trap, poor contrast.

---

## Set up your local copy

You need **Node.js 20 or newer** and **npm**. Check with `node --version`.

### 1. Fork and clone

Click **Fork** at the top right of the repository page, then:

```bash
git clone https://github.com/YOUR-USERNAME/oss-match.git
cd oss-match
npm install
```

Add the original repository as a second remote so you can pull in updates later:

```bash
git remote add upstream https://github.com/anshc022/oss-match.git
```

### 2. Create your env file

```bash
cp .env.example .env.local
```

`.env.local` is gitignored and must stay that way. Never commit real values.

### 3. Get a database

Either option works. Atlas is closer to how the deployed app runs.

**Option A: MongoDB Atlas (free tier).**

1. Create an account at [mongodb.com/atlas](https://www.mongodb.com/atlas) and
   create a free **M0** cluster.
2. Under **Database Access**, add a database user with a password. Use a
   generated password rather than one you reuse elsewhere.
3. Under **Network Access**, add your current IP address. For a laptop that
   moves between networks, `0.0.0.0/0` is convenient but only acceptable for a
   throwaway development cluster.
4. Press **Connect**, choose **Drivers**, and copy the connection string. Put
   your password in place of `<password>` and add a database name at the end:

   ```
   MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/oss-match
   ```

**Option B: MongoDB locally**, via Docker:

```bash
docker run -d -p 27017:27017 --name oss-match-mongo mongo:7
```

```
MONGODB_URI=mongodb://127.0.0.1:27017/oss-match
```

### 4. Create a GitHub OAuth app for sign-in

Go to [github.com/settings/developers](https://github.com/settings/developers)
and press **New OAuth App**.

| Field | Value |
| --- | --- |
| Application name | OSS Match (local) |
| Homepage URL | `http://localhost:3000` |
| Authorization callback URL | `http://localhost:3000/api/auth/callback/github` |

Generate a client secret, then fill in `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET`. The app only ever requests `read:user` and
`user:email`.

### 5. Fill in the rest

```bash
# A random signing key for sessions
openssl rand -base64 32     # -> NEXTAUTH_SECRET

# Any value; the cron route refuses to run without one
openssl rand -hex 32        # -> CRON_SECRET
```

`NEXTAUTH_URL=http://localhost:3000` is already in the template.

**`GITHUB_TOKEN` is technically optional and practically necessary.** Without
it, GitHub allows 60 requests an hour, which one feed refresh can exhaust. If
you have the [GitHub CLI](https://cli.github.com) installed:

```bash
gh auth token
```

Paste that into `GITHUB_TOKEN`. It is a personal token: keep it in `.env.local`
only, and never paste it into an issue or pull request.

`LLM_API_KEY` is genuinely optional. Without it, the skill graph, mentor
suggestions, and the Deep Dive architecture map fall back to heuristics. The app
works fully; the results are just less specific. Do not obtain a key purely to
contribute.

---

## Run the app

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with GitHub.

The feed reads from MongoDB, not from GitHub directly, so a fresh database shows
an empty feed. Fill it once:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "http://localhost:3000/api/cron/fetch-issues?force=1"
```

That takes a minute or two and indexes a few hundred issues. See
[CRON.md](CRON.md) for what it does and the query parameters it accepts.

---

## Making a change

1. Sync your `main` with upstream, so you branch from current code:

   ```bash
   git checkout main
   git pull upstream main
   ```

2. Create a branch (see naming below).
3. Make the change. Keep it focused on one thing.
4. Run the checks.
5. Push and open a pull request.

**One change per pull request.** A pull request that fixes a bug and also
reformats forty files is hard to review and usually gets slower feedback, not
faster.

---

## Branch naming

```
<type>/<short-description>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `a11y`.

```
fix/duplicate-cards-after-skip
docs/atlas-setup-steps
a11y/feed-keyboard-focus
test/scoring-freshness-factor
```

Lowercase, hyphens between words, no issue numbers needed.

---

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org). The format
is short:

```
<type>(<optional scope>): <what changed, in the imperative>
```

```
fix(feed): keep skipped issues out of the next page
docs(contributing): add Atlas network access step
test(scoring): cover the freshness factor at the cutoff
a11y(deepdive): label the tab buttons for screen readers
```

Rules that matter:

- Imperative mood: "add", not "added" or "adds".
- No full stop at the end of the subject line.
- Keep the subject under about 72 characters.
- If the *why* is not obvious, add a blank line and explain it in the body.

Nothing enforces this automatically. If your history is messy, that is fine, we
squash on merge.

---

## Tests and checks

Run all four before you push. CI runs exactly these, so a green local run means
a green pull request.

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # unit and integration tests
npm run build       # production build
```

Tests live in [`tests/`](tests/) and run on the Node test runner through `tsx`.
There is no test framework to learn beyond `node:test` and `node:assert`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

test("a skipped issue does not come back", () => {
  assert.equal(actual, expected);
});
```

Run one file while you work:

```bash
npx tsx --test tests/scoring.test.ts
```

Tests that need a database use `mongodb-memory-server`, which downloads a
MongoDB binary the first time and then runs entirely in memory. Nothing external
is required.

**When to add a test:** any change to scoring, fetching, or data shaping should
come with one. Pure styling changes usually should not.

---

## Opening the pull request

```bash
git push origin your-branch-name
```

GitHub prints a link to open the pull request. The template asks for a summary,
the linked issue, how you tested, and screenshots for anything visual. Fill it
in; it is the fastest route to a merge.

For UI changes, include **both light and dark mode**. The app supports both and
a change that only works in one is not finished.

Mark the pull request as a **draft** if you want early feedback on an unfinished
change. That is welcome and not a sign of anything.

---

## What happens next

- CI runs lint, typecheck, tests, and a production build. It must pass before
  merging; `main` is protected and does not accept direct pushes.
- Vercel builds a preview deployment and comments the URL. Click it and check
  your change on the real thing.
- A maintainer reviews. Review comments are about the code, never about you.
  Asking "what do you mean here?" is always a reasonable reply.
- Push more commits to the same branch to update the pull request. No need to
  close and reopen.

Reviews may take a few days. A polite nudge after a week is fine.

---

## What makes a good first pull request here

A good one is **small, complete, and verifiable**. Some concrete examples that
fit this repository:

- **Documentation that unblocked you.** If a setup step was wrong or missing,
  fix it while the confusion is fresh. You are the best-placed person to.
- **A test for existing behaviour.** Pick a function in `src/lib/` with no
  coverage, read it, and write a test for what it already does. This is the
  single best way to learn a codebase and it is genuinely wanted.
- **An accessibility fix.** A button with no accessible name, an element that
  cannot be reached by keyboard, text that fails contrast in one theme.
- **Small UI polish with a screenshot.** Spacing, a truncated label, a hover
  state that does nothing.
- **An empty or loading state.** Several lists show nothing at all before data
  arrives. A skeleton or a sentence is a real improvement.

Things to avoid for a first contribution:

- Dependency bumps and lockfile-only changes.
- Whole-file reformatting, or renaming things because you prefer other names.
- Changes to the scoring weights in `src/lib/scoring.ts` without a rationale.
  These are tuned and tested; propose the change in an issue first.
- New dependencies. Open an issue and make the case before adding one.

---

## Project layout

```
src/
  app/                Next.js App Router: pages and API routes
    api/              feed, saved, guide, cron, skillgraph, mentors, deepdive
  components/         React components (shadcn/ui primitives in ui/)
  lib/
    scoring.ts        the six-factor match algorithm
    fetcher/          background GitHub fetching and rate limiting
    skillgraph/       reads your GitHub history into a skill profile
    mentor/           finds an active maintainer to ask
    deepdive/         repo structure collection and AI architecture mapping
    llm.ts            the one place that talks to a language model
  models/             Mongoose schemas
tests/                node:test suites
```

Two ideas explain most of the structure:

1. **Fetching is decoupled from serving.** A scheduled job writes issues into
   MongoDB; the feed only ever reads from MongoDB. No user request waits on
   GitHub. See the architecture section of the [README](README.md).
2. **AI is always optional.** Every AI-backed feature has a heuristic fallback
   and must keep working with `LLM_API_KEY` unset.

---

## Common problems

**The feed is empty.** The database has no issues yet. Run the cron call in
[Run the app](#run-the-app).

**`MongoServerError: bad auth`.** The password in `MONGODB_URI` is wrong, or it
contains characters that need URL-encoding. Encode `@` as `%40`, `/` as `%2F`,
`:` as `%3A`.

**Atlas connection times out.** Your current IP is not in **Network Access**.
Home connections change IP more often than you would expect.

**GitHub sign-in redirects to an error.** The callback URL in your OAuth app
must be exactly `http://localhost:3000/api/auth/callback/github`.

**403 rate limit in the terminal.** `GITHUB_TOKEN` is missing or expired. Run
`gh auth token` again.

**A schema change seems to do nothing.** Mongoose caches compiled models across
hot reloads, so new fields are silently dropped until you restart the dev
server. Stop `npm run dev` and start it again.

**`npm run dev` breaks right after `npm run build`.** The build overwrites
`.next` underneath the running dev server. Restart the dev server.

---

By contributing, you agree that your work is licensed under the
[MIT License](LICENSE) and that you will follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

Thank you. Genuinely.
