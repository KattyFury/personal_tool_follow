# Verification

Run `npm ci`, `npm test`, `npm run check`, and `npx playwright test`.

The UI tests use installed Google Chrome (`channel: chrome`) with mocked extension messages and fixture tab names. They do not use the user's profile, log in, or follow real accounts.

Coverage includes:

- X Personal SF threshold and missing-score behavior; whitelist protection.
- Binance feed scoping, deduplication, Following detection, and rejection of profile pages.
- Stop cancellation during a pending wait.
- Unconfirmed actions remain counted and stop the runner.
- Serialized background reservations enforce the daily cap across tabs.
- Stale run tokens and non-owner tabs cannot reserve attempts.
- Late messages cannot revive a stopped run.
- Vietnam-time day rollover and settings validation.
- Sidebar settings switching, save, Start and Stop.
- Vertical settings/functions 1:2 proportions; complete panel at 400×800 and 400×740.
- No horizontal overflow at 390, 360, and 320 pixels; functional text remains at least 12 pixels.

## Manual validation still needed

The extension has not been installed in the user's Chrome or tested on live X / Binance accounts. Current server behavior, account-specific UI, localization, and Kaito badge injection cannot be established from fixtures. Binance's adapter is deliberately limited to identifiable feed cards; if the current DOM differs, it will scroll and stop without following. Do not relax selectors to global Follow buttons. Confirm the actual feed card and profile link structure first.

Begin with a session cap of 1 or another small cap in settings. Check the platform tab and confirmed count. A successful fixture test does not establish platform authorization, an official platform daily limit, or protection from restrictions. No captcha bypasses, stealth, or private API calls are implemented.
