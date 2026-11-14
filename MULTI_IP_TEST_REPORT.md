# Stream Tube v8.8 — Multi-IP Load Simulation

Executed: 2026-10-31

## Method
Node VM route-handler harness, mocked Watchmode, bounded batches of 250, one registered test account, simulated request IPs. No real sockets, multiple processes, or distributed users.

| Scenario | IPs | Requests | Successful | HTTP 429 | Other | Upstream calls | Simulated elapsed ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| 100 IPs x 10 | 100 | 1,000 | 1,000 | 0 | 0 | 19 | 132 |
| 1000 IPs x 10 | 1,000 | 10,000 | 10,000 | 0 | 0 | 19 | 752 |
| 10000 IPs x 1 | 10,000 | 10,000 | 10,000 | 0 | 0 | 19 | 2,299 |
| 10 IPs x 200 | 10 | 2,000 | 1,200 | 800 | 0 | 19 | 102 |
| 1 shared IP x 200 | 1 | 200 | 120 | 80 | 0 | 19 | 27 |
| Spoofed forwarded header x 200 | 200 | 200 | 120 | 80 | 0 | 19 | 22 |

## Findings
- Per-IP rate limit allows separate IPs independent quotas (120/minute).
- Shared public IPs can cause legitimate clients to be rate-limited together.
- Distributing traffic across IPs can bypass aggregate protection even if per-IP limits work as designed.
- X-Forwarded-For spoofing did not change the limiter identity in this VM harness; actual proxy deployment requires separate validation.
- All scenarios used one shared authenticated session, so they do not test concurrent login or independent user account load.
- All scenarios produced 19 upstream calls due to shared in-process caching/deduplication; this is not proof of cross-instance deduplication.
- Elapsed time measures mocked handler execution only, not actual HTTP latency or capacity.

## Recommended follow-up
Add account-based and global upstream budgets alongside IP-based limits; move rate-limit/session/cache state to a shared store for multi-instance deployments; test behind a configured trusted reverse proxy; measure real HTTP throughput, p95 latency, CPU, memory, and error rate in staging.
