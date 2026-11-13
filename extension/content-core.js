(() => {
  if (globalThis.PersonalFollow) return;
  let active = null, busy = false;
  const ask = async data => {
    const response = await chrome.runtime.sendMessage(data);
    if (!response?.ok) throw Error(response?.error || 'Extension connection lost.');
    return response;
  };
  const visible = el => !!el?.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  function stopped() { const error = Error('Stopped'); error.name = 'AbortError'; return error; }
  globalThis.PersonalFollow = {
    visible, random,
    register(adapter) {
      ask({ type: 'hello', platform: adapter.id }).catch(() => {});
      function check(run) {
        if (active !== run || run.controller.signal.aborted) throw stopped();
        if (!adapter.allowed(run.settings)) throw Error('Page changed. Open the correct platform page.');
        const notices = [...document.querySelectorAll('[role="alert"], [role="dialog"], [data-testid="toast"], .bn-notification, .bn-modal')].filter(visible);
        if (notices.some(el => /captcha|verify (?:your|you are)|verification required|too many|rate.?limit|temporarily (?:restricted|blocked)|daily limit|try again later|xác minh|quá nhiều|giới hạn/i.test(el.textContent))) throw Error('Platform restriction or verification prompt. Check the platform tab.');
        if (document.querySelector('iframe[src*="captcha"], [data-testid="ocfEnterTextTextInput"], #login-dialog')) throw Error('Login or verification required.');
      }
      async function execute(run) {
        let misses = 0, capReached = false;
        const seen = new Set();
        const report = (status, nextAt = null) => ask({ type: 'status', platform: adapter.id, token: run.token, running: true, status, nextAt });
        const ctx = {
          settings: run.settings, seen,
          check: () => check(run),
          wait(ms) {
            check(run);
            return new Promise((resolve, reject) => {
              const signal = run.controller.signal;
              const abort = () => { clearTimeout(timer); reject(stopped()); };
              const timer = setTimeout(() => { signal.removeEventListener('abort', abort); try { check(run); resolve(); } catch (e) { reject(e); } }, ms);
              signal.addEventListener('abort', abort, { once: true });
            });
          },
          report,
          note: text => { run.note = text; },
          ask: data => ask({ ...data, platform: adapter.id, token: run.token }),
          async hover(element) {
            check(run);
            if (!['binance', 'x'].includes(adapter.id) || !visible(element)) throw Error('Hover target is unavailable.');
            const rect = element.getBoundingClientRect();
            const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            if (point.x < 0 || point.y < 0 || point.x >= innerWidth || point.y >= innerHeight) throw Error('Hover target is outside the visible feed.');
            const hit = document.elementFromPoint(point.x, point.y);
            if (!hit || (hit !== element && !element.contains(hit))) throw Error('Hover target is covered. Close the overlay and start again.');
            // Debugger input uses viewport DIPs; CSS px differ when browser zoom != 100%. Calibrate once per run.
            const hovered = () => element.matches(':hover');
            const tryFactor = async factor => {
              const reply = await ask({ type: 'movePointer', platform: adapter.id, token: run.token, point, factor });
              run.zoom = reply.zoom || 1;
              await new Promise(r => setTimeout(r, 150)); check(run);
              return hovered();
            };
            if (await tryFactor(run.pointerFactor || 1)) return;
            const factors = [...new Set([1, run.zoom, 1 / run.zoom, devicePixelRatio, 1 / devicePixelRatio].map(f => Math.round(f * 1000) / 1000))].filter(f => f !== (run.pointerFactor || 1) && f >= 0.25 && f <= 5);
            for (const factor of factors) if (await tryFactor(factor)) { run.pointerFactor = factor; return; }
            await tryFactor(run.pointerFactor || 1);
            await report(`Pointer missed the name (zoom ${Math.round(run.zoom * 100)}%, pixel ratio ${devicePixelRatio}). Try Ctrl+0 on the Binance tab.`);
          },
          async unhover() {
            check(run);
            await ask({ type: 'movePointer', platform: adapter.id, token: run.token, point: { x: 1, y: 1 } });
            check(run);
          },
          async action(button, verify, confirm) {
            check(run);
            if (!visible(button) || button.disabled) throw Error('Target changed. Start again after checking the page.');
            const reservation = await ask({ type: 'reserve', platform: adapter.id, token: run.token });
            capReached = reservation.count >= run.settings.dailyLimit;
            check(run);
            button.click();
            if (confirm) await confirm(ctx);
            for (let i = 0; i < 20; i++) { await ctx.wait(250); if (verify()) { await ask({ type: 'confirmed', platform: adapter.id, token: run.token, day: reservation.day }); return; } }
            throw Error('Action outcome is unclear. Stopped; the attempt remains counted.');
          }
        };
        try {
          await adapter.prepare?.(ctx);
          while (true) {
            check(run);
            await report('Looking for an eligible account…');
            const outcome = await adapter.step(ctx);
            if (outcome === 'acted') {
              if (capReached) throw Error('Daily cap reached.');
              misses = 0;
              const delay = random(run.settings.minDelay * 1000, run.settings.maxDelay * 1000);
              const label = 'Waiting for the next action' + (run.note ? ' · ' + run.note : '');
              run.note = null;
              await report(label, Date.now() + delay); await ctx.wait(delay);
            } else {
              if (outcome === 'empty' && ++misses >= 12) throw Error('No more eligible accounts found. Check the feed before restarting.');
              await ctx.wait(1000);
            }
          }
        } catch (error) {
          const status = error.name === 'AbortError' ? 'Stopped' : error.message;
          await ask({ type: 'status', platform: adapter.id, token: run.token, running: false, status }).catch(() => {});
        } finally { if (active === run) active = null; busy = false; }
      }
      chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (sender.id !== chrome.runtime.id) return;
        if (message.type === 'stop') { active?.controller.abort(); respond({ ok: true }); return; }
        if (message.type !== 'start') return;
        if (busy) { respond({ ok: false, error: 'Previous run is stopping. Try again in a moment.' }); return; }
        if (!adapter.allowed(message.settings)) { respond({ ok: false, error: 'Open the page for the selected action: followers, post replies, following, or the Square feed.' }); return; }
        busy = true;
        active = { token: message.token, settings: message.settings, controller: new AbortController() };
        respond({ ok: true });
        execute(active);
      });
      window.addEventListener('pagehide', () => active?.controller.abort());
    }
  };
})();
