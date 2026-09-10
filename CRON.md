# Scheduled fetching

`vercel.json` triggers `/api/cron/fetch-issues` **hourly**. The interval you
actually care about is enforced per query, not by the schedule.

## Why the schedule is fixed at hourly

A `vercel.json` cron expression is static: it is read at deploy time and cannot
be switched by an environment variable. So the cron fires every hour and each
query decides whether it is due:

| Query kind | Refresh interval | Set by |
| --- | --- | --- |
| Normal | 3 hours | `NORMAL_INTERVAL_MS` |
| Normal, boost on | 1 hour | `FETCH_BOOST_MODE=true` or `HACKTOBERFEST_MODE=true` |
| Hacktoberfest-labelled | 30 minutes | `HACKTOBERFEST_MODE=true` |

An hourly invocation where nothing is due exits in well under a second, having
done one Mongo read and no GitHub calls. Flipping the env flag changes the
effective cadence without a schedule change or redeploy of the cron config.

## Triggering by hand

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-app>/api/cron/fetch-issues"

# ignore refresh intervals, and narrow to two languages
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-app>/api/cron/fetch-issues?force=true&languages=TypeScript,Go"
```

Without `CRON_SECRET` set the route refuses to run. A caller with the wrong
secret gets a 404, so probing does not confirm the route exists. Vercel Cron
sends the secret as `Authorization: Bearer`; `x-cron-secret` also works.

## Hosting note

Vercel's Hobby plan permits daily cron only. Hourly needs Pro. On Hobby, either
run the schedule elsewhere (GitHub Actions, cron-job.org) hitting the same URL
with the same header, or accept a daily cycle.

## Reading the logs

Each cycle prints one block:

```
[fetch] cycle done in 41.3s · auth=app · hacktoberfest=on
[fetch] queries: 22 run of 60 planned · 38 skipped
[fetch] etag: 14 hits / 8 misses (64% unchanged)
[fetch] issues upserted: 214 · repos resolved: 96
[fetch] rate limit: 4102/5000 · resets in 38m
```

A high ETag hit rate is the goal: those queries cost one request and no scoring
work. `deferred at floor` means the rate-limit guard stopped handing out calls
with budget still reserved for the request path.
