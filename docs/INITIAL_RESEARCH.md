# tool_personal_follow

Personal Chrome extension for Binance Square. Research stage; implementation has not started.

## Requested behavior

- Follow accounts encountered while scrolling the Square feed.
- Daily cap: 500 follow attempts, persisted across browser restarts. This is a user-selected cap, not a verified Binance limit.
- Random delay of 10–30 seconds between follow attempts.
- Start, pause, and stop controls.

## Repository research — 2026-11-11

### Recommended foundation: WXT

https://github.com/wxt-dev/wxt

MIT licensed, TypeScript extension framework with Manifest V3 support, development reloads, and packaging. GitHub metadata checked today: 10,721 stars; pushed 2026-11-11. Popularity and activity support the shortlist but are not a security audit. Use the official vanilla TypeScript starter rather than inventing build infrastructure. Preserve required license notices for any reused source.

### Official API patterns: Google Chrome samples

https://github.com/GoogleChrome/chrome-extensions-samples

Official Google samples, Apache-2.0 licensed. GitHub metadata checked today: 17,852 stars; pushed 2026-11-10. Study content scripts, messaging, storage, and service-worker lifecycle. Avoid archived Manifest V2 examples.

### Closest functional match: Binance Square Follow Manager

https://github.com/unityheroes/binance-Square-Follow-Manager-addon

Inspected README.md, manifest.json, and content.js on main. Root listing contains five files and no license file; do not copy its code without a verified license or permission. Useful as a behavior and selector reference, not a production-ready base.

Observed issues:

- Selects .follow-card-item and .feed-follow-button button; applicability to the current scrolling feed is unverified.
- Marks a follow successful immediately after dispatching click events. No confirmed Following state or server outcome.
- Each tab independently reads and writes the daily counter, so simultaneous runs can exceed the intended cap.
- Date is captured once per run, so a session crossing midnight does not roll over correctly.
- Running flag is set after asynchronous storage work, leaving a concurrent-start race.
- End-of-page handling can stop before an infinite feed finishes loading.
- Runs on all www.binance.com pages instead of only Square.
- No tests or build setup in root listing.
- README claims about avoiding detection do not establish reliability or account safety.

### Workflow reference: Automa

https://github.com/AutomaApp/automa

Useful for studying workflow execution, scheduling, and status reporting. Repository states mixed AGPL/commercial licensing. Do not copy code until the applicable license is checked. A general workflow engine is more machinery than this narrow extension needs.

## Recommended implementation approach

Use WXT for extension scaffolding and Google samples for browser API patterns. Keep Binance DOM handling in a small replaceable adapter, validated against the actual feed before enabling actions. Persist attempt reservations centrally in one background authority so tabs cannot overshoot 500; track confirmed follows separately from attempts. Reserve before clicking, and stop on uncertain outcomes rather than blindly retrying. Support cancellation of delays, prevent overlapping runs, deduplicate account IDs, and handle midnight consistently using Asia/Ho_Chi_Minh unless changed by the user. Stop on login requirements, verification prompts, restrictions, or unknown UI states. Use only Square page access; no trading permissions, wallet access, private API reverse engineering, or detection bypasses.

## Validation still required

Current Square feed selectors and success state, platform restrictions, installed Chrome behavior, and the extension itself have not been tested. Research references are not installed or executed.
