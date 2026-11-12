(() => {
  const { visible, random } = PersonalFollow;
  const text = button => (button.textContent || button.getAttribute('aria-label') || '').trim().toLowerCase();
  const following = button => /^(following|đang theo dõi)$/.test(text(button)) || /(?:^|-)unfollow$/.test(button.dataset.testid || '');
  const follow = button => /^(follow|follow back|theo dõi|theo dõi lại)$/.test(text(button));
  const score = el => {
    const value = el.querySelector('.signal-avatar-badge__value');
    const match = value?.textContent.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([km])?/i);
    return match ? Math.round(parseFloat(match[1]) * (match[2] ? (/k/i.test(match[2]) ? 1e3 : 1e6) : 1)) : null;
  };
  const verified = el => !!el.querySelector('svg[aria-label="Verified account"], svg[aria-label="Tài khoản đã xác minh"], svg[aria-label="Tài khoản đã xác nhận"], [data-testid="icon-verified"], [data-testid="verifiedIcon"]');
  const ad = el => ['Promoted', 'Quảng cáo', 'Được quảng bá'].some(t => el.textContent.includes(t));
  // People only: X gives organisations (gold check) square avatars; people keep round ones.
  const gold = el => [...el.querySelectorAll('[data-testid="icon-verified"]')].some(icon => icon.querySelector('linearGradient'));
  const person = el => {
    if (gold(el)) return false;
    const avatar = el.querySelector('[data-testid^="UserAvatar-Container"]');
    if (!avatar) return true;
    return [avatar, ...avatar.querySelectorAll('a, a div')].some(node => /^(?:9999px|50%)$/.test(getComputedStyle(node).borderRadius));
  };
  function handle(el) {
    const links = el.querySelectorAll('[data-testid="User-Name"] a[href^="/"], a[href^="/"]');
    for (const link of links) if (/^\/[a-z0-9_]{1,15}$/i.test(link.getAttribute('href'))) return { link, name: link.getAttribute('href').slice(1).toLowerCase() };
    return null;
  }
  async function settle(ctx, el) {
    el.scrollIntoView({ behavior: 'instant', block: 'center' });
    await ctx.wait(random(900, 1300));
    if (ctx.settings.personal) for (let i = 0; i < 40 && el.isConnected && score(el) === null; i++) await ctx.wait(200);
    return el.isConnected ? score(el) : null;
  }
  async function confirm(ctx) {
    for (let i = 0; i < 20; i++) {
      await ctx.wait(300);
      const button = document.querySelector('[data-testid="confirmationSheetConfirm"]') || [...document.querySelectorAll('[role="menuitem"], [role="dialog"] button')].find(el => /^(unfollow|bỏ theo dõi)$/i.test(el.textContent.trim()));
      if (visible(button)) { ctx.check(); button.click(); return; }
    }
    throw Error('Unfollow confirmation was not found. Check the X tab.');
  }
  // Mass follow runs on any tweet timeline (Home feed, a post's replies, search, lists, profiles), not on account lists or settings.
  const timeline = () => !/^\/(?:i\/|messages|settings|notifications|compose)|\/(?:followers|verified_followers|following|likes)\/?$/.test(location.pathname);
  // "Who to follow" list (x.com/i/connect_people): each UserCell has its own Follow button, no hover needed.
  const connect = () => /^\/i\/connect_people\/?$/.test(location.pathname);
  PersonalFollow.register({
    id: 'x',
    allowed: settings => ['x.com', 'twitter.com'].includes(location.hostname) && (settings?.mode === 'follow' ? /\/(?:verified_followers|followers)\/?$/.test(location.pathname) : settings?.mode === 'massfollow' ? timeline() || connect() : /\/following\/?$/.test(location.pathname)),
    async prepare(ctx) {
      const mode = ctx.settings.mode;
      if (mode === 'follow' && !/\/(?:verified_followers|followers)\/?$/.test(location.pathname)) throw Error('Open your X followers or verified followers list.');
      if (mode === 'massfollow' && !timeline() && !connect()) throw Error('Open x.com/i/connect_people (Who to follow) or your X Home feed for Mass follow.');
      if (mode.startsWith('unfollow') && !/\/following\/?$/.test(location.pathname)) throw Error('Open your X following list.');
      if (mode === 'unfollow') {
        let previous = 0, stable = 0;
        await ctx.report('Scrolling to the bottom of Following…');
        for (let i = 0; i < 100 && stable < 3; i++) {
          ctx.check(); window.scrollTo(0, document.body.scrollHeight); await ctx.wait(1500);
          const height = document.body.scrollHeight;
          stable = height === previous ? stable + 1 : 0; previous = height;
        }
        if (stable < 3) throw Error('Following list is too long to reach the bottom. Use top to bottom.');
        if (ctx.settings.personal) { await ctx.report('Waiting for Kaito SF…', Date.now() + 60000); await ctx.wait(60000); }
      }
    },
    async step(ctx) {
      const list = ctx.settings.mode === 'massfollow' && connect();
      const mass = ctx.settings.mode === 'massfollow' && !list, unfollow = ctx.settings.mode.startsWith('unfollow');
      let cells = [...document.querySelectorAll(mass ? 'article[data-testid="tweet"]' : '[data-testid="UserCell"]')];
      // On a post page, skip the post itself; on Home every tweet is a candidate.
      if (mass && /\/status\/\d+/.test(location.pathname)) cells = cells.filter(cell => !cell.querySelector('time')?.closest('a')?.getAttribute('href')?.endsWith(location.pathname.split('/').pop()));
      if (ctx.settings.mode === 'unfollow') cells.reverse();
      const whitelist = ctx.settings.whitelist.split(',').map(s => s.trim());
      for (const cell of cells) {
        ctx.check();
        const target = handle(cell);
        if (!target || ctx.seen.has(target.name) || ad(cell)) continue;
        ctx.seen.add(target.name);
        if (mass && !verified(cell)) continue;
        if ((mass || list) && !person(cell)) continue;
        let button = [...cell.querySelectorAll('button')].find(unfollow ? following : follow);
        if (!mass && !button) continue;
        if (unfollow && whitelist.includes(target.name)) continue;
        const sf = await settle(ctx, cell);
        if (ctx.settings.personal && (unfollow ? sf === null || sf > 10 : !(sf > 10))) continue;
        if (unfollow && !ctx.settings.personal && verified(cell) && /follows you|theo dõi bạn/i.test(cell.textContent)) continue;
        if (mass) {
          // Like Binance: move the real browser pointer onto the author's name, wait for X's hover card, follow from it.
          let found = null;
          for (let attempt = 0; attempt < 2 && !found && target.link.isConnected; attempt++) {
            if (attempt) { await ctx.unhover(); await ctx.wait(700); target.link.scrollIntoView({ behavior: 'instant', block: 'center' }); await ctx.wait(400); }
            const nameTarget = cell.querySelector('[data-testid="User-Name"] a[href="/' + target.link.getAttribute('href').slice(1) + '"]') || target.link;
            await ctx.report(`Hovering @${target.name} (${attempt + 1}/2)…`);
            await ctx.hover(nameTarget);
            for (let i = 0; i < 20 && !found; i++) {
              await ctx.wait(300);
              for (const card of document.querySelectorAll('[data-testid="HoverCard"]')) {
                if (!visible(card)) continue;
                const cardHandle = handle(card);
                if (!cardHandle || cardHandle.name !== target.name) continue;
                if ([...card.querySelectorAll('button')].some(following)) found = 'following';
                else { const b = [...card.querySelectorAll('button')].find(follow); if (b) found = b; }
              }
            }
          }
          if (!found) { await ctx.unhover(); await ctx.report(`Skipped @${target.name}: no hover card.`); return 'skipped'; }
          if (found === 'following') { await ctx.unhover(); return 'skipped'; }
          button = found;
        }
        if (!cell.isConnected || !visible(button)) continue;
        await ctx.report(`${unfollow ? 'Unfollowing' : 'Following'} @${target.name}…`);
        await ctx.action(button, () => {
          if (!button.isConnected && !unfollow) return false;
          return unfollow ? (button.isConnected && follow(button)) || (cell.isConnected && [...cell.querySelectorAll('button')].some(follow)) : following(button);
        }, unfollow ? confirm : undefined);
        if (mass) await ctx.unhover().catch(() => {});
        else document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10 }));
        return 'acted';
      }
      window.scrollBy({ top: ctx.settings.mode === 'unfollow' ? -random(600, 900) : random(600, 900) });
      return 'empty';
    }
  });
})();
