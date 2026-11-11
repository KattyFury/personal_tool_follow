(() => {
  const { visible } = PersonalFollow;
  const isFollow = el => /^(?:\+\s*)?(?:follow|theo dõi)$/i.test(el.textContent.trim());
  const isFollowing = el => /^(following|đang theo dõi)$/i.test(el.textContent.trim());
  const allowed = () => /^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?square(?:\/|$)/.test(location.pathname) && !/\/(?:profile|creator|post|following|followers)(?:\/|$)/.test(location.pathname);
  PersonalFollow.register({
    id: 'binance', allowed,
    async prepare() {
      if (/\/(?:profile|creator|post|following|followers)(?:\/|$)/.test(location.pathname)) throw Error('Open the Binance Square feed, not a profile or post.');
    },
    async step(ctx) {
      const buttons = [...document.querySelectorAll('main .feed-follow-button button, main [class*="follow-button"] button, main button, [role="main"] button, .feed-follow-button button')];
      for (const button of buttons) {
        if (!visible(button) || button.disabled || !isFollow(button)) continue;
        const card = button.closest('article, [data-testid="feed-card"], .feed-card, .feed-item, .follow-card-item, [class*="FeedCard"]');
        if (!card || !visible(card) || card.closest('aside, [role="complementary"]')) continue;
        const link = card.querySelector('a[href*="/square/profile/"]');
        if (!link) continue;
        const account = new URL(link.href).pathname.match(/\/square\/profile\/([^/]+)/)?.[1];
        if (!account || ctx.seen.has(account)) continue;
        ctx.seen.add(account);
        button.scrollIntoView({ block: 'center', behavior: 'instant' });
        await ctx.wait(500);
        if (!isFollow(button)) continue;
        await ctx.report(`Following ${link.textContent.trim() || account}…`);
        await ctx.action(button, () => button.isConnected && isFollowing(button));
        return 'acted';
      }
      window.scrollBy({ top: Math.max(400, Math.round(window.innerHeight * 0.7)) });
      return 'empty';
    }
  });
})();
