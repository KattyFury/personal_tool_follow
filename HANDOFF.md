# Handoff — Personal Follow

Date: 2026-11-11 (Asia/Ho_Chi_Minh). Current version: 0.3.2.

## Locations

- Private repo: https://github.com/KattyFury/tool_personal_follow
- User working copy: D:\Files\Claude\tool_personal_follow
- Chrome Load unpacked folder: D:\Files\Claude\tool_personal_follow\extension
- A second development copy exists under C:\Users\Dell\Documents\Codex\2026-11-11\i\work\tool_personal_follow. Keep copies synchronized through Git; check for local edits first.

## User requirements — follow these

- Native Chrome side panel, opened by extension toolbar icon. No full-tab dashboard.
- VERTICAL layout: settings TOP one third; platform functions BOTTOM two thirds.
- Design is BLACK, YELLOW #F5B301, WHITE, with neutral greys. Do not propose blue. Use the supplied design system product palette (0xhieu-xyz), not its generic blue defaults.
- Single compact screen. X, Binance, Other platforms placeholder.
- X: adapt existing source from tool_personal_xmanager; Personal SF >10 filter and Standard option; four action modes and whitelist.
- X Rest controls AND batch-rest behavior removed in 0.3.1. Whitelist has the freed space. Keep per-action delays.
- Binance: hover an author name, open the matching profile card, follow, wait 10–30 seconds, then scroll. Daily cap 500 by default.
- Keep communication brief. User explicitly approved the debugger permission for real hover.

## Current implementation

Dependency-free Manifest V3 extension. Runtime code lives in extension/. Node dependencies are development/test-only.

- manifest.json: sidePanel, storage, tabs, debugger permissions; people emoji icons.
- background.js: run ownership, serialized daily reservations, settings, debugger lifecycle.
- pointer.js: actual Chrome Input.dispatchMouseEvent mouseMoved, limited to active selected Binance Square tab.
- content-core.js: cancellable execution, per-action delay, attempt/confirmed counts, cap enforcement, hover bridge and hit testing.
- content-binance.js: feed author selectors from supplied card header; hover retries; matching profile links OR exact display name plus handle/avatar; excludes menus; three consecutive missing cards stop execution. No JavaScript-dispatched hover in production Binance.
- content-x.js: X adapter. X hover logic remains adapted from original source.
- sidepanel.html/css/js: vertical UI; yellow Start/Save/selection/running states; expanded Whitelist.
- design/: original copied tokens and CSS from repo_personal_design. Source history/provenance in docs/SOURCES.md.
- reference/xmanager/: original user scripts retained unchanged for comparison.

## Important behavior

Daily caps count attempts reserved BEFORE clicking; confirmed outcomes tracked separately. Counters reset at midnight Vietnam time. X defaults 400/day, 60–90 sec. Binance defaults 500/day, 10–30 sec. These are configured caps, not verified platform limits. Legacy userscript settings/counters are not migrated automatically. Disable legacy X Manager scripts while using this extension.

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

Requires installed Google Chrome for browser checks. Last relevant runs: 24 unit/DOM/background tests passed for 0.3.1; 6 UI tests passed on palette update, including exact yellow color and layout sizes. Browser hover proof and integrated CSS-hover-only fixture passed when introduced in 0.3.0. Fixtures use isolated Chrome and no live accounts.

## Recent commits

- 13237ef: correct black-yellow-white palette (0.3.2)
- 31bb128: remove X rests, expand Whitelist (0.3.1)
- 4273cd9: actual browser hover through approved debugger permission (0.3.0)

## Updating

Work in the D: copy or synchronize carefully. Commit/push and update the other copy with git pull --ff-only only after checking local changes. Reload Personal Follow in chrome://extensions, refresh Binance/X, then verify version in sidebar footer. New permission was explicitly approved; do not repeatedly ask for the same permission. Do not bypass any new approval rejection.

No active implementation request remains. User requested handoff and stopping.
