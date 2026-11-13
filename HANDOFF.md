# Handoff — Personal Follow

Date: 2026-11-11 (Asia/Ho_Chi_Minh). Current version: 0.7.3.

## Locations

- Private repo: https://github.com/KattyFury/personal_tool_follow
- User working copy: D:\Files\Claude\personal_tool_follow
- Chrome Load unpacked folder: D:\Files\Claude\personal_tool_follow\extension
- A second development copy may exist under C:\Users\Dell\Documents\Codex\2026-11-11\i\work\ (old folder name tool_personal_follow). Its remote still works through the GitHub redirect, but switch it to the new URL. Keep copies synchronized through Git; check for local edits first.

## User requirements — follow these

- Native Chrome side panel, opened by extension toolbar icon. No full-tab dashboard.
- Short side panel (0.5.4): settings/cards never shrink below their content; below ~640px tall the panel scrolls vertically instead of overlapping. Tall panels keep the exact 1:2 split (flex 1 : 2, platforms basis = 4 x --pf-tile-pad to offset the settings padding).
- Binance Square is the DEFAULT / primary platform (0.5.2, user request 2026-11-12): settings open on Binance, Binance button first in the segmented control, Binance card above X.
- VERTICAL layout: settings TOP one third; platform functions BOTTOM two thirds.
- Design is BLACK, YELLOW #F5B301, WHITE, with neutral greys. Do not propose blue. Use the supplied design system product palette (0xhieu-xyz), not its generic blue defaults.
- Single compact screen. X, Binance, Other platforms placeholder.
- X: adapted from the old X Manager userscripts (GitHub repo tool_personal_xmanager was DELETED 2026-11-11; the only copy is reference/xmanager/ here, do not delete it); Personal SF >10 filter and Standard option; four action modes and whitelist.
- X Rest controls AND batch-rest behavior removed in 0.3.1. Whitelist has the freed space. Keep per-action delays.
- Binance: hover an author name, open the matching profile card, follow, wait 60–90 seconds, then scroll. Daily cap 150 by default (lowered from 400 on 2026-11-12; background migrates a stored 400 to 150 once, flag binanceCap150).
- Binance Follow back (0.6.0): Action select on the Binance card (feed | followback). followback runs only on /square/profile/<handle>/followers; each row [data-avatar] has its own Follow/Following button, clicked directly (no hover, no debugger: usesPointer is false). Scrolls the window to load more (20 per page). Selectors checked read-only on the live page 2026-11-12; no live follow made by Claude.
- Keep communication brief. User explicitly approved the debugger permission for real hover.

## Current implementation

Dependency-free Manifest V3 extension. Runtime code lives in extension/. Node dependencies are development/test-only.

- manifest.json: sidePanel, storage, tabs, debugger permissions; people emoji icons.
- background.js: run ownership, serialized daily reservations, settings, debugger lifecycle.
- pointer.js: actual Chrome Input.dispatchMouseEvent mouseMoved, limited to the active selected Binance Square or X tab. background usesPointer(p, settings) = Binance, or X in massfollow mode: only those runs attach/release the debugger.
- content-core.js: cancellable execution, per-action delay, attempt/confirmed counts, cap enforcement, hover bridge and hit testing.
- content-binance.js: feed author selectors from supplied card header; hover retries; matching profile links OR exact display name plus handle/avatar; excludes menus; three consecutive missing cards stop execution. No JavaScript-dispatched hover in production Binance.
- content-x.js: X adapter. Since 0.5.0 Mass follow works like Binance (user request 2026-11-12): on the HOME FEED (or any tweet timeline: post replies, search, lists, profiles; not followers/following/likes/settings/messages/notifications) it scrolls, moves the REAL browser pointer (debugger) onto each verified replier's name, waits up to 6 s for X's [data-testid=HoverCard] whose handle matches, follows from that card, then moves the pointer away; 2 hover attempts, otherwise skip. Follow back / Unfollow modes still click list buttons directly (no pointer).
- sidepanel.html/css/js (0.4.0 redesign): app bar with icon + version pill (footer removed). Settings tile (white): segmented X/Binance + Saved/Unsaved indicator + Save; Daily cap | Delay min-max; Whitelist textarea fills the remaining height with the SF>10 Kaito switch in its header (X only); Binance shows a one-line note instead. Platform cards (black #161616, color-scheme dark): logo, title, open link, status chip; yellow attempts counter + progress meter (#<platform>-meter = attempts/limit); X Action select saves the X mode immediately on change and is disabled while running; status line; tab select + Stop + Start in one row. A running card gets a yellow inset outline (.is-running) and a pulsing chip. #x-mode-label is kept as sr-only for JS. Styles use only design/web.css tokens plus --pf-* aliases to the neutral palette.
- design/: original copied tokens and CSS from repo_personal_design (GitHub repo now named personal_repo_designsystem). Source history/provenance in docs/SOURCES.md.
- reference/xmanager/: original user scripts retained unchanged for comparison.

## Important behavior

Daily caps count attempts reserved BEFORE clicking; confirmed outcomes tracked separately. Counters reset at midnight Vietnam time. X defaults 400/day, 60–90 sec. Binance defaults 150/day, 60–90 sec. These are configured caps, not verified platform limits. Legacy userscript settings/counters are not migrated automatically. Disable legacy X Manager scripts while using this extension.

Binance uses Chrome debugger browser input because dispatchEvent does not produce actual CSS hover. This does not move the Windows hardware cursor. Keep Binance source tab active; close its DevTools. Chrome shows its debugger notification. Stop, completion/errors, navigation and disconnect stop/detach the session. Rejects non-owner tabs, stale tokens, subframes, invalid coordinates and non-Square routes. Follow clicks currently use DOM button.click with outcome verification; actual browser input is used for hover.

## Confirmed by user / remaining limits

User explicitly reported version 0.3.0 worked well on Binance after actual browser input was added. 0.3.1 removed X rests; 0.3.2 corrected the palette. These later UI changes were verified in fixtures, not by new live follows. X and account-specific/localized markup still need live validation if issues arise. Do not claim fixture tests prove every live account works.

## Verification

npm ci
npm test
npm run check
npx playwright test
node scripts/check-browser-hover.js
node scripts/check-binance-hover.js
node scripts/check-binance-zoom.js

Requires installed Google Chrome for browser checks. Last runs (0.4.0, 2026-11-11): npm test all passed, npm run check passed, 6/6 Playwright UI tests passed (1:2 ratio, fits 400x740, no overflow at 320-390px, yellow Start/segment/running chip). Browser hover proof and integrated CSS-hover-only fixture passed when introduced in 0.3.0. Fixtures use isolated Chrome and no live accounts.

## Recent commits

- 0.7.3: the Settings toggle also picks the card: Binance shows only the Binance Square card, X only the X card (user request 2026-11-13). A hidden card keeps running.

- 0.7.2: comment outcome (posted text or skip reason) stays in the status line during the wait ('Waiting for the next action · …'); before, skip reasons were overwritten at once. User reported 0.7.1 followed but never commented; cause not yet known.

- 0.7.1: Comment text holds up to 20 comments, one per line (textarea); the runner uses them in turn, starting at a random line each run, advancing only after a posted comment.

- 0.7.0: Binance feed 'Comment after follow' (off by default): after a NEW follow, opens the post's .comments-icon composer (.short-editor-inner.modal, tiptap ProseMirror), checks the composer's .nick matches the author, types commentText via execCommand insertText, clicks Reply. Own daily cap (commentLimit, default 30, counts.binanceComments); at the cap it keeps following without comments. Composer markup checked read-only on the live page 2026-11-12 (typed then cleared, nothing posted). Success = composer closes or editor empties: NOT yet confirmed by a live post.

- 0.6.1: X Mass follow also runs on x.com/i/connect_people (Who to follow; user's main target): direct click on each UserCell Follow button, no hover; people only (round avatar, no gold check: X gives organisations square avatars) + SF > 10 when the Kaito switch is on. Also recognises the Vietnamese 'Tài khoản đã xác nhận' verified label. Filter checked read-only on the live page 2026-11-12. Limitation: projects using a round avatar and blue check still pass the people filter. Home hover was confirmed working live (card appears); Home mostly shows already-followed accounts, so it skips them.

- 0.6.0: Binance Follow back mode + Binance cap 150.

- 0.5.1: X Mass follow no longer requires opening a post; user wants it to scroll the Home feed (2026-11-12). Verified-only filter and SF>10 option unchanged.

- 0.5.0: X Mass follow uses real-pointer hover cards like Binance (see content-x.js above). Verified in jsdom tests only; NOT yet run live on X. Chrome shows its debugger bar on the X tab during Mass follow; keep that tab active.

- 0.4.2: ROOT CAUSE of 'hover works on laptop, not on PC' (confirmed by user 2026-11-11): the Binance tab was too NARROW, so Binance did not show profile hover cards even for a manual hover. Live check on the PC: cards work at 568px and at ~1051px (they can take a few seconds or stay stuck on a spinner; a stale card of the previous author can linger until the pointer leaves). Exact cutoff width not measured. content-binance: refuses to start below 480px; below 600px the skip status and the 3-failure error tell the user to widen the window. The 0.4.1 zoom calibration is kept but was not the cause.

- 0.4.1: Binance hover zoom fix. Laptop worked, PC did not: debugger Input.dispatchMouseEvent coordinates are not CSS px when the tab zoom != 100%, so the pointer missed the name. content-core hover() now checks element.matches(':hover') after each move; on a miss it tries factors [1, tab zoom, 1/zoom, devicePixelRatio, 1/dpr] and keeps the working one per run (run.pointerFactor). background returns chrome.tabs.getZoom in the movePointer reply; pointer.move(tabId, point, factor). On total miss the status shows zoom + pixel ratio and suggests Ctrl+0. Simulated in scripts/check-binance-zoom.js (125%). NOT yet confirmed live on the PC.

- 86edc44: side panel redesign — black platform cards, yellow counters + progress meter, running card outlined in yellow, X/Binance segmented settings, Whitelist with inline SF>10 switch, tab picker + Stop/Start on one row, X Action change saves immediately.
- 13237ef: correct black-yellow-white palette (0.3.2)
- 31bb128: remove X rests, expand Whitelist (0.3.1)
- 4273cd9: actual browser hover through approved debugger permission (0.3.0)

## Updating

Work in the D: copy or synchronize carefully. Commit/push and update the other copy with git pull --ff-only only after checking local changes. Reload Personal Follow in chrome://extensions, refresh Binance/X, then verify the version pill at the top right of the sidebar (v0.5.1). New permission was explicitly approved; do not repeatedly ask for the same permission. Do not bypass any new approval rejection.

## Open items

- The 0.4.0 redesign is verified only in fixtures/screenshots; the user has not yet confirmed it live in Chrome. For visual fixes edit sidepanel.css (one block per component, no end-of-file overrides).
- X still needs live validation on real accounts.

No active implementation request remains. User requested handoff.
