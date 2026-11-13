(() => {
  const { visible } = PersonalFollow;
  const isFollow = el => /^(?:\+\s*)?(?:follow|follow back|theo dõi|theo dõi lại)$/i.test(el.textContent.trim());
  const isFollowing = el => /^(following|đang theo dõi)$/i.test(el.textContent.trim());
  const feed = () => /^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?square(?:\/|$)/.test(location.pathname) && !/\/(?:profile|creator|post|following|followers)(?:\/|$)/.test(location.pathname);
  // Follow back runs on a Square followers list: /square/profile/<handle>/followers.
  const followers = () => /^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?square\/profile\/[^/]+\/followers\/?$/.test(location.pathname);
  const allowed = settings => settings?.mode === 'followback' ? followers() : feed();
  const profile = link => {
    try { const url = new URL(link.getAttribute('href'), location.href); return url.hostname === location.hostname ? url.pathname.match(/\/square\/profile\/([^/]+)/)?.[1].toLowerCase() : null; } catch { return null; }
  };
  const overlays = '[role="tooltip"], [data-popper-placement], .bn-bubble, .bn-tooltips, .bn-popover, [class*="user-card"], [class*="UserCard"], [class*="profile-card"], [class*="ProfileCard"], [class*="user-info"], [class*="UserInfo"], [class*="popover"], [class*="Popover"]';
  function findProfileCard(account, link) {
    const associated = new Set();
    for (let el = link, depth = 0; el && depth < 5; el = el.parentElement, depth++) {
      for (const id of (el.getAttribute('aria-describedby') || el.getAttribute('aria-controls') || '').split(/\s+/).filter(Boolean)) { const tip = document.getElementById(id); if (tip) associated.add(tip); }
    }
    const candidates = new Set([...associated, ...document.querySelectorAll(overlays)]);
    for (const button of document.querySelectorAll('button, [role="button"]')) {
      if (!visible(button) || (!isFollow(button) && !isFollowing(button))) continue;
      for (let parent = button.parentElement, depth = 0; parent && depth < 6; parent = parent.parentElement, depth++) {
        const style = getComputedStyle(parent), rect = parent.getBoundingClientRect();
        if (['absolute', 'fixed'].includes(style.position) && rect.width <= 600 && rect.height <= 500) candidates.add(parent);
      }
    }
    const normalize = value => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    const name = normalize(link.textContent);
    const imageKey = image => { try { const u = new URL(image.currentSrc || image.src, location.href); return u.origin + u.pathname; } catch { return null; } };
    const sourceImages = new Set([...document.querySelectorAll('a[href*="/square/profile/"]')].filter(a => profile(a) === account && !a.closest(overlays)).flatMap(a => [...a.querySelectorAll('img')]).map(imageKey).filter(Boolean));
    for (const card of candidates) {
      if (!visible(card) || card.contains(link) || card.querySelector('.menu-item')) continue;
      const profiles = [...card.querySelectorAll('a[href*="/square/profile/"]')];
      const texts = [...card.querySelectorAll('a, div, span, p, strong, h1, h2, h3')].map(el => normalize(el.textContent));
      const sameName = name && texts.includes(name);
      const sameHandle = texts.some(text => (text.match(/@[a-z0-9_-]+/g) || []).some(handle => handle.slice(1) === account));
      const sameAvatar = [...card.querySelectorAll('img')].some(image => sourceImages.has(imageKey(image)));
      const identified = profiles.length ? profiles.some(a => profile(a) === account) : associated.has(card) || sameName && (sameHandle || sameAvatar);
      if (!identified) continue;
      const buttons = [...card.querySelectorAll('button, [role="button"]')].filter(visible);
      const following = buttons.find(isFollowing);
      if (following) return { card, following: true };
      const button = buttons.find(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true' && isFollow(el));
      if (button) return { card, button };
    }
    return null;
  }
  let scrollNext = false, hoverFailures = 0, commentCapHit = false, commentTurn = 0;
  // Comment after follow (0.7.0). Live markup checked read-only 2026-11-12: the card's .comments-icon opens a
  // reply composer (.short-editor-inner.modal) on the same page with a tiptap/ProseMirror editor and a Reply button
  // (class "inactive" while empty). The close X is the first child of the composer. Nothing was posted while checking.
  const norm = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const composer = () => [...document.querySelectorAll('.short-editor-inner.modal')].find(visible);
  async function closeComposer(ctx) {
    const inner = composer(); if (!inner) return;
    const editor = inner.querySelector('[contenteditable="true"]');
    if (editor && norm(editor.textContent)) { editor.focus(); document.execCommand('selectAll'); document.execCommand('delete'); }
    const close = inner.firstElementChild?.querySelector('svg') || inner.firstElementChild;
    close?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    for (let i = 0; i < 8 && composer(); i++) await ctx.wait(250);
  }
  const say = (ctx, text) => { ctx.note?.(text); return ctx.report(text); };
  async function commentOn(ctx, link, account) {
    if (commentCapHit) return;
    // Comments are used in turn (one per line), starting at a random line each run.
    const lines = String(ctx.settings.commentText || '').split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length) return;
    const text = lines[commentTurn % lines.length];
    const icon = link.closest('.card-content-box')?.querySelector('.comments-icon .cursor-pointer') || link.closest('.card-content-box')?.querySelector('.comments-icon');
    if (!icon || !visible(icon)) { await say(ctx, 'Followed ' + account + '; no comment button on this post.'); return; }
    await ctx.unhover().catch(() => {});
    ctx.check(); icon.click();
    let inner; for (let i = 0; i < 20 && !(inner = composer()); i++) await ctx.wait(250);
    if (!inner) { await say(ctx, 'Followed ' + account + '; comment box did not open, comment skipped.'); return; }
    try {
      const nick = inner.querySelector('.nick');
      if (nick && norm(nick.textContent) !== norm(link.textContent)) { await say(ctx, 'Comment box shows another post; comment skipped for ' + account + '.'); return; }
      const editor = inner.querySelector('.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"]');
      const host = inner.closest('.short-editor') || inner;
      const reply = () => [...host.querySelectorAll('button')].find(b => visible(b) && /^(reply|trả lời|phản hồi)$/i.test(b.textContent.trim()));
      if (!editor || !reply()) { await say(ctx, 'Comment box layout changed; comment skipped for ' + account + '.'); return; }
      editor.focus(); document.execCommand('insertText', false, text);
      await ctx.wait(500);
      const button = reply();
      if (norm(editor.textContent) !== norm(text) || !button || button.disabled || button.classList.contains('inactive')) { await say(ctx, 'Could not type the comment; skipped for ' + account + '.'); return; }
      let reservation;
      try { reservation = await ctx.ask({ type: 'reserveComment' }); }
      catch (error) { if (/cap/i.test(error.message)) { commentCapHit = true; await say(ctx, 'Comment cap reached; following only from now on.'); return; } throw error; }
      ctx.check(); button.click();
      for (let i = 0; i < 32; i++) {
        await ctx.wait(250);
        const open = composer();
        if (!open || !norm(open.querySelector('[contenteditable="true"]')?.textContent)) {
          commentTurn++;
          await ctx.ask({ type: 'commentConfirmed', day: reservation.day }).catch(() => {});
          await say(ctx, 'Commented: “' + text + '”');
          return;
        }
      }
      throw Error('Comment outcome is unclear. Stopped; check the post on the Binance tab. The comment remains counted.');
    } finally { if (composer()) await closeComposer(ctx).catch(() => {}); }
  }
  // Follow back: each follower row ([data-avatar]) carries its own Follow / Following button. No hover needed.
  async function followBack(ctx) {
    for (const row of document.querySelectorAll('[data-avatar]')) {
      const link = row.querySelector('.nick-username a[href*="/square/profile/"], a[href*="/square/profile/"]');
      const account = link && profile(link);
      if (!account || ctx.seen.has(account)) continue;
      const button = [...row.querySelectorAll('button, [role="button"]')].find(el => visible(el) && (isFollow(el) || isFollowing(el)));
      if (!button) continue;
      ctx.seen.add(account);
      if (isFollowing(button) || button.disabled) continue;
      ctx.check();
      row.scrollIntoView({ block: 'center', behavior: 'instant' });
      await ctx.wait(600);
      if (!row.isConnected || !visible(button) || !isFollow(button)) continue;
      await ctx.report('Following back ' + account + '…');
      await ctx.action(button, () => (button.isConnected && isFollowing(button)) || [...row.querySelectorAll('button, [role="button"]')].some(isFollowing));
      return 'acted';
    }
    ctx.check(); window.scrollTo({ top: document.documentElement.scrollHeight });
    await ctx.report('Loading more followers…');
    await ctx.wait(2000);
    return 'empty';
  }
  // Binance hides/limits profile hover cards when the tab is narrow (seen on a PC with the side panel open).
  const NARROW = 600;
  const widthHint = () => innerWidth < NARROW ? ` The Binance tab is only ${innerWidth}px wide: hover cards may not appear. Widen the Chrome window (or close other side panels) and start again.` : ' If the Binance tab is zoomed, press Ctrl+0 there and start again.';
  PersonalFollow.register({
    id: 'binance', allowed,
    async prepare(ctx) {
      scrollNext = false; hoverFailures = 0; commentCapHit = false; commentTurn = Math.floor(Math.random() * 1000);
      if (ctx?.settings?.mode === 'followback') {
        if (!followers()) throw Error('Open your Binance Square followers list (Profile > Followers).');
        return;
      }
      if (!feed()) throw Error('Open the Binance Square feed, not a profile or post.');
      if (innerWidth < 480) throw Error(`The Binance tab is only ${innerWidth}px wide, too narrow for profile hover cards. Widen the Chrome window and start again.`);
    },
    async step(ctx) {
      if (ctx.settings.mode === 'followback') return followBack(ctx);
      if (scrollNext) { ctx.check(); window.scrollBy({ top: Math.max(300, Math.round(window.innerHeight * 0.6)) }); scrollNext = false; await ctx.wait(1000); }
      const names = [...document.querySelectorAll('.card__hd-wrapper .nick-username a[href*="/square/profile/"], .card__hd .nick-username a[href*="/square/profile/"], article .avatar-name-container a[href*="/square/profile/"], [data-testid="feed-card"] .avatar-name-container a[href*="/square/profile/"]')];
      for (const link of names) {
        if (!visible(link) || link.closest('aside, [role="complementary"]')) continue;
        const rect = link.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
        const account = profile(link);
        if (!account || ctx.seen.has(account)) continue;
        ctx.check(); ctx.seen.add(account);
        link.scrollIntoView({ block: 'center', behavior: 'instant' });
        await ctx.wait(500);
        let hoverTarget = link;
        try {
          let target = null;
          for (let attempt = 0; attempt < 3 && !target && link.isConnected; attempt++) {
            if (attempt) {
              await ctx.unhover();
              await ctx.wait(750);
              link.scrollIntoView({ block: 'center', behavior: 'instant' });
              await ctx.wait(500);
            }
            hoverTarget = attempt === 1 ? link.closest('.avatar-name-container') || link : link;
            await ctx.report('Moving browser pointer to ' + account + ' (' + (attempt + 1) + '/3)…');
            ctx.check(); await ctx.hover(hoverTarget);
            await ctx.report('Pointer moved; waiting for ' + account + ' profile card…');
            for (let i = 0; i < 24; i++) { await ctx.wait(250); target = findProfileCard(account, link); if (target) break; }
          }
          if (!target) {
            hoverFailures++;
            if (hoverFailures >= 3) throw Error('Cannot identify profile hover cards for 3 consecutive accounts after retries. Check whether hovering a name opens a profile card; the hover-card HTML may need updating.' + widthHint());
            await ctx.report('Skipped ' + account + ': no matching hover card after 3 tries.' + (innerWidth < NARROW ? ` Tab is narrow (${innerWidth}px), widen the window.` : ''));
            return 'skipped';
          }
          hoverFailures = 0;
          await ctx.report('Profile card detected for ' + account);
          if (target.following) { await ctx.report('Already following ' + account); return 'skipped'; }
          ctx.check();
          await ctx.report('Following ' + account + ' from the hover card…');
          await ctx.action(target.button, () => {
            const current = findProfileCard(account, link);
            return !!current?.following || (target.button.isConnected && isFollowing(target.button));
          });
          if (ctx.settings.comment) await commentOn(ctx, link, account);
          scrollNext = true;
          return 'acted';
        } finally { await ctx.unhover().catch(() => {}); }
      }
      ctx.check(); window.scrollBy({ top: Math.max(400, Math.round(window.innerHeight * 0.7)) });
      return 'empty';
    }
  });
})();
