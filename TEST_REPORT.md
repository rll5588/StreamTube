# Stream Tube v8.8 — Test report

## Purpose
Assess application-level throttling at increased logical request volumes and validate new account registration policies without contacting the live Watchmode API.

## Executed results

| Test | Logical requests | Accepted HTTP 200 | Rate-limited HTTP 429 | Mocked upstream calls |
|---|---:|---:|---:|---:|
| Same-IP load | 1,000 | 120 | 880 | 19 |
| Same-IP load | 10,000 | 120 | 9,880 | 19 |
| Same-IP load | 100,000 | 120 | 99,880 | 19 |
| **Analytical model only** | **1,000,000** | **120 (projected)** | **999,880 (projected)** | **Not executed** |

All executed load requests were made through a local VM route harness, in batches of 250. This tests route logic and the per-IP limit; it does not test 1,000–1,000,000 simultaneous real users. The single-IP limiter resets after one minute; the model assumes no reset. Because the authenticated test account was created before the timed run, these request counts exclude registration.

## Compatibility and account validation

- Existing regression suite: 38/38 passed.
- New account rules: 18/18 passed, including valid registration, rejected invalid names, common/short/oversized passwords, username/email reuse in passwords, case-insensitive duplicates, and successful login.
- The first account test run had one failure due to an incorrect **test fixture**: the alleged maximum-length password actually exceeded the allowed 128 characters. The fixture was corrected to 128 characters and all 18 passed. No application defect was identified by that case.

## Observed issues and limitations

1. Per-IP throttling means a single shared NAT/IP may block many legitimate users; this test cannot estimate the number of independent clients the server supports.
2. A one-million-user capacity claim is unsupported. No real million-client concurrency run occurred.
3. Rate-limit and session maps are in memory; multi-instance deployments need shared state and explicit reverse-proxy configuration.
4. Synchronous scrypt password hashing may block the Node event loop during bursts of registrations; registration load testing and asynchronous hashing are recommended before launch.
5. Local JSON account persistence remains unsuitable for production. User data is not yet stored in a scalable database.

## Suggested next validation

Use an isolated staging environment with a mocked streaming provider and measured HTTP requests, monitoring CPU, memory, p50/p95 latency, error rates, and Watchmode call counts. Ramp gradually from 50 to 100, 250, 500 and 1,000 concurrent HTTP clients. Only extrapolate toward larger numbers after scaling the architecture and proving the earlier stages.
