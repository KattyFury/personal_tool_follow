(() => {
  const { visible } = PersonalFollow;
  const isFollow = el => /^(?:\+\s*)?(?:follow|theo dõi)$/i.test(el.textContent.trim());
  const isFollowing = el => /^(following|đang theo dõi)$/i.test(el.textContent.trim());
  const allowed = () => /^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?square(?:\/|$)/.test(location.pathname) && !/\/(?:profile|creator|post|following|followers)(?:\/|$)/.test(location.pathname);
  const profile = link => {
    try { const url = new URL(link.getAttribute('href'), location.href); return url.hostname === location.hostname ? url.pathname.match(/\/square\/profile\/([^/]+)/)?.[1].toLowerCase() : null; } catch { return null; }
  };
  const overlays = '[role="tooltip"], [data-popper-placement], .bn-bubble, .bn-tooltips, .bn-popover, [class*="user-card"], [class*="UserCard"], [class*="profile-card"], [class*="ProfileCard"], [class*="user-info"], [class*="UserInfo"], [class*="popover"], [class*="Popover"]';
  function hover(link, enter) {
    const rect = link.getBoundingClientRect();
    const options = { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, relatedTarget: document.body };
    const types = enter ? ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'mousemove'] : ['pointerout', 'pointerleave', 'mouseout', 'mouseleave'];
    for (const type of types) link.dispatchEvent(new (type.startsWith('pointer') && window.PointerEvent ? PointerEvent : MouseEvent)(type, { ...options, bubbles: !type.endsWith('enter') && !type.endsWith('leave') }));
  }
  function findProfileCard(account, link) {
    const associated = new Set();
    for (let el = link, depth = 0; el && depth < 5; el = el.parentElement, depth++) {
      for (const id of (el.getAttribute('aria-describedby') || el.getAttribute('aria-controls') || '').split(/\s+/).filter(Boolean)) { const tip = document.getElementById(id); if (tip) associated.add(tip); }
    }
    for (const card of new Set([...associated, ...document.querySelectorAll(overlays)])) {
      if (!visible(card) || card.contains(link) || card.querySelector('.menu-item')) continue;
      const profiles = [...card.querySelectorAll('a[href*="/square/profile/"]')];
      if (profiles.length ? !profiles.some(a => profile(a) === account) : !associated.has(card)) continue;
      const buttons = [...card.querySelectorAll('button, [role="button"]')].filter(visible);
      const following = buttons.find(isFollowing);
      if (following) return { card, following: true };
      const button = buttons.find(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true' && isFollow(el));
      if (button) return { card, button };
    }
    return null;
  }
  let scrollNext = false, hoverFailures = 0;
  PersonalFollow.register({
    id: 'binance', allowed,
    async prepare() {
      scrollNext = false; hoverFailures = 0;
      if (!allowed()) throw Error('Open the Binance Square feed, not a profile or post.');
    },
    async step(ctx) {
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
              hover(hoverTarget, false);
              await ctx.wait(750);
              link.scrollIntoView({ block: 'center', behavior: 'instant' });
              await ctx.wait(500);
            }
            hoverTarget = attempt === 1 ? link.closest('.avatar-name-container') || link : link;
            await ctx.report('Hovering ' + account + ' (' + (attempt + 1) + '/3)…');
            ctx.check(); hover(hoverTarget, true);
            for (let i = 0; i < 24; i++) { await ctx.wait(250); target = findProfileCard(account, link); if (target) break; }
          }
          if (!target) {
            hoverFailures++;
            if (hoverFailures >= 3) throw Error('Cannot identify profile hover cards for 3 consecutive accounts after retries. Check whether hovering a name opens a profile card; the hover-card HTML may need updating.');
            await ctx.report('Skipped ' + account + ': no matching hover card after 3 tries.');
            return 'skipped';
          }
          hoverFailures = 0;
          if (target.following) { await ctx.report('Already following ' + account); return 'skipped'; }
          ctx.check();
          await ctx.report('Following ' + account + ' from the hover card…');
          await ctx.action(target.button, () => {
            const current = findProfileCard(account, link);
            return !!current?.following || (target.button.isConnected && isFollowing(target.button));
          });
          scrollNext = true;
          return 'acted';
        } finally { hover(hoverTarget, false); }
      }
      ctx.check(); window.scrollBy({ top: Math.max(400, Math.round(window.innerHeight * 0.7)) });
      return 'empty';
    }
  });
})();
