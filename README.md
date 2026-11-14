# Stream Tube v8.9 — Portable shared quotas and account-aware limits

## Moving to another computer (Windows / macOS / Linux)

1. Install **Node.js 22 or later** and ensure `node` and `npm` are on PATH.
2. Copy/extract this complete folder to the other computer. Do not transfer `.env`, `server/private`, or customer accounts unless you explicitly intend to move private information securely.
3. Copy `.env.example` to `.env`, enter your own `WATCHMODE_API_KEY`, and adjust the optional quota values to match your API plan.
4. From the folder containing `package.json`, run `npm ci` (requires an internet connection to install dependencies), then `npm start`. Alternatively, use `START_WINDOWS.bat` or `sh START_MAC_LINUX.sh`.
5. Open `http://localhost:3000`. Register a new test account on the second machine. Accounts are local to each installation.
6. To run tests: `node tests/regression.js`, `node tests/account_policy.js`, `node tests/v89_integration.js`.

## Changes from v8.8

- **Account quota**: authenticated requests are limited to 60/minute per username (configurable), in addition to IP limits (120/minute API, 12/minute authentication).
- **Global Watchmode request budget**: default 90 outbound calls/minute, counted across multiple local Node processes using the same data directory; adjust to your Watchmode subscription allowance.
- **Provider concurrency cap**: default six simultaneous upstream operations per process. Excess work receives a provider-busy error; this is not a queue.
- **Shared quota state**: quota counters live in `server/private/quotas.json` by default, coordinated with an atomic directory lock for processes on the same local filesystem. Configure `STREAM_TUBE_DATA_DIR` to change storage location.
- Previous search, account rules, genre recommendations, cache deduplication, HTTP security headers and session checks remain in place.

## Test evidence and limitations

- Existing offline route regression: **38/38 passed**.
- Existing account policy: **18/18 passed**.
- New v8.9 checks: **6/6 passed**.
- These are **mocked route/middleware tests**, not real HTTP concurrency or 1,000–1,000,000-user benchmarks. The earlier multi-IP suite is included but was not fully completed in this round; it is slow with the shared-file quota implementation.
- **Portability is packaged but not independently verified on a second computer**. `npm ci` could not complete in this environment, so a real Express HTTP smoke test was not performed.

## Security and production limitations

- **Do not deploy this prototype for real customers.** The JSON account store is not transaction-safe, sessions are in-memory (logins expire on restart and are not shared across workers), and file-backed quotas are intended for local multi-process testing only.
- File locks can remain after a crash and require operator recovery after confirming no other process is using the store. Avoid shared network drives. For production, use Redis for distributed rate limiting and sessions, and a transactional database for users.
- Provider quota is consumed when attempting an upstream operation, not per retry. Rate-limited requests return 429; upstream budget exhaustion returns a 502 in the current handlers. Improve error status propagation before deployment.
- The default `HOST=127.0.0.1` deliberately binds only to localhost. To allow access from other devices, configure your network and TLS reverse proxy carefully; copying the app to a different computer does not require exposing it publicly.
- Keep `.env` out of ZIPs and version control. Review Watchmode terms and quota before changing limits.
