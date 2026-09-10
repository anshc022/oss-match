import { waitUntil } from "@vercel/functions";

/**
 * Keep a promise alive after the response has been sent.
 *
 * A serverless function is frozen the moment it responds, so a bare
 * `void doWork()` is silently dropped in production even though it completes
 * fine under `next dev`, where the process keeps running. That is what left
 * the mentor card and the Deep Dive sheet spinning forever: every request
 * started work that died before it could write anything, so the next request
 * found nothing cached and started again.
 *
 * `waitUntil` hands the promise to the platform, which holds the instance open
 * until it settles or the function's own limit is reached. Off-platform it is a
 * no-op wrapper, so the promise simply runs to completion in the live process.
 */
export function afterResponse(work: Promise<unknown>) {
  const swallowed = work.catch((err) => {
    console.error("[after-response] background work failed:", err);
  });

  try {
    waitUntil(swallowed);
  } catch {
    // Not running on the platform: the process stays alive on its own.
    void swallowed;
  }
}
