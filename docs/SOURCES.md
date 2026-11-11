# Source provenance

## X manager

Copied from the user's repository, with authorization in this chat:

- https://github.com/KattyFury/tool_personal_xmanager
- Source commit: `69b8ad3fbea609c0006441c8c874e28e739aafba`
- Both original userscripts are preserved unchanged in `reference/xmanager/` for comparison. These copies are not executed by the extension.
- `extension/content-x.js` adapts the original UserCell and tweet selectors, Kaito score parsing, SF > 10 threshold, verified badge detection, hover-card targeting, four modes, whitelist, scrolling directions, and burst-rest behavior. The Personal version's latest executable code and HANDOFF take precedence over older conflicting MEMORY descriptions.
- Full original default whitelist is retained. Whitelist matching is exact instead of prefix matching.
- Standard mode comes from the non-Personal script: follow without SF, preserve verified accounts that follow you when unfollowing.

The adapter is not a byte-for-byte copy: the old floating UI, page-local counters, and timer loop are replaced by the shared dashboard, extension storage, cancellable execution, and action confirmation. In particular, missing SF skips Personal unfollows, uncertain outcomes stop instead of retrying, and attempts are reserved before clicks.

No license was added to upstream source. This private derivative is for the user's project; do not assume permission to redistribute it.

## Personal design system

- https://github.com/KattyFury/repo_personal_design
- Source commit: `ee8079aa14c0d75dc480b1a9543b2634dc5a4571`
- `web.css` and `tokens.json` copied unchanged into `extension/design/`.
- Dashboard uses Bento v4 canvas, white tiles, 20/10/pill radii, functional type tokens, compact spacing, and weights 400/600/700.
- Product layout requested by user: desktop 2:1 columns, platform controls left, settings right. Small screens stack these regions to avoid horizontal scrolling.
- Short desktop screens use existing 8/12/16/24 spacing tokens so the complete screen fits 1366×768. No custom font sizes or colors were introduced.

## Other research

- https://github.com/wxt-dev/wxt — MIT framework considered. The existing source is a dependency-free userscript; this version retains a small native Manifest V3 setup rather than adding a framework.
- https://github.com/GoogleChrome/chrome-extensions-samples — official Apache-2.0 browser API reference; no sample code copied.
- https://github.com/unityheroes/binance-Square-Follow-Manager-addon — inspected for behavior and `.feed-follow-button` selector reference. No source copied; root lacked a license file when reviewed.
- https://github.com/AutomaApp/automa — workflow reference; no source copied.
