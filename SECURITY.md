# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Use GitHub's private reporting instead: go to the
[Security tab](https://github.com/anshc022/oss-match/security/advisories/new)
and open a draft advisory. That page is private to you and the maintainers.

Tell us what you found, how to reproduce it, and what an attacker could do with
it. A proof of concept helps but is not required.

You should get a first reply within a few days. If a fix is needed we will agree
a disclosure date with you, and you will be credited in the advisory unless you
would rather not be.

## What is in scope

The application in this repository and its deployment configuration. In
particular we care about:

- anything that exposes one user's data to another
- anything that lets a request act as a different user
- token or secret leakage, including into logs, error pages or the client bundle
- authentication bypass on the API routes

## What is not in scope

- Vulnerabilities in GitHub, Vercel, MongoDB Atlas or another third party.
  Report those to the party that runs the service.
- Findings that need a compromised developer machine, or physical access.
- Missing hardening headers with no demonstrated impact.
- Reports produced entirely by an automated scanner with no working exploit.

## Demo mode

`npm run demo` starts a sign-in that hands out a local account with no password.
It is deliberately impossible to enable on a deployed build: it requires
`DEMO_MODE=true`, refuses to run when `NODE_ENV` is `production`, and refuses
whenever `VERCEL` is set, which covers preview deployments as well as
production. Those gates are asserted in `tests/demo.test.ts`.

If you find a way to reach that provider on a deployed instance, that is a
vulnerability and we would very much like to hear about it.

## Handling secrets

Never commit a real credential. `.env.local` is gitignored and must stay that
way. If you believe a secret has been exposed, say so in a private advisory
rather than a pull request, so it can be rotated before it is public.
