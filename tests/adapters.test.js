import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

async function adapter(file, html, url) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  let value;
  dom.window.PersonalFollow = { visible: el => !!el?.isConnected, random: a => a, register: item => { value = item; } };
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.scrollBy = () => {};
  dom.window.eval(await readFile(new URL('../extension/' + file, import.meta.url), 'utf8'));
  return { dom, value };
}
function context(overrides = {}) {
  return { settings: { mode: 'follow', personal: true, whitelist: '' }, seen: new Set(), check() {}, wait: async () => {}, report: async () => {}, action: async () => { throw Error('Unexpected action'); }, ...overrides };
}
test('X Personal follow uses source SF threshold and skips missing scores', async () => {
  const { dom, value } = await adapter('content-x.js', '<div data-testid="UserCell"><a href="/alice">Alice</a><span class="signal-avatar-badge__value">10</span><button>Follow</button></div><div data-testid="UserCell"><a href="/bob">Bob</a><button>Follow</button></div><div data-testid="UserCell"><a href="/carol">Carol</a><span class="signal-avatar-badge__value">11</span><button>Follow</button></div>', 'https://x.com/me/verified_followers');
  let target;
  const result = await value.step(context({ action: async b => { target = b.closest('div').querySelector('a').getAttribute('href'); } }));
  assert.equal(result, 'acted'); assert.equal(target, '/carol'); dom.window.close();
});
test('X whitelist uses exact handles; missing SF never triggers Personal unfollow', async () => {
  const { dom, value } = await adapter('content-x.js', '<div data-testid="UserCell"><a href="/alice">Alice</a><span class="signal-avatar-badge__value">0</span><button>Following</button></div><div data-testid="UserCell"><a href="/bob">Bob</a><button>Following</button></div>', 'https://x.com/me/following');
  assert.equal(await value.step(context({ settings: { mode: 'unfollow_topdown', personal: true, whitelist: 'alice' } })), 'empty'); dom.window.close();
});
const binanceHeader = '<div class="card__hd-wrapper"><div class="card__hd"><div class="avatar-name-container avatar-nickname-v2"><div class="avatar-nick-container"><div class="avatar-nick-box"><div class="nick-username"><a href="/en/square/profile/killiankillua" class="nick">Killian Killua</a></div></div></div></div><div class="card__hd-extra"><div role="tooltip" class="bn-bubble"><div class="menu-item"><span>Follow</span></div></div></div></div></div>';
const binanceURL = 'https://www.binance.com/en/square';
function showProfile(dom, name = 'killiankillua', following = false) {
  const card = dom.window.document.createElement('div'); card.className = 'bn-bubble';
  card.innerHTML = '<a href="/en/square/profile/' + name + '">Profile</a><button>' + (following ? 'Following' : 'Follow') + '</button>';
  dom.window.document.body.append(card); return card;
}
test('Binance hovers supplied nickname markup, follows matching profile, then scrolls', async () => {
  const { dom, value } = await adapter('content-binance.js', '<main><button id="unrelated">Follow</button>' + binanceHeader + binanceHeader + '</main>', binanceURL);
  const order = []; let card;
  showProfile(dom, 'someone_else');
  dom.window.document.querySelector('.avatar-name-container').addEventListener('mouseover', () => { order.push('hover'); if (!card) card = showProfile(dom); });
  dom.window.scrollBy = () => order.push('scroll');
  const ctx = context({ action: async (button, verify) => { assert.equal(button.closest('.bn-bubble'), card); order.push('follow'); button.textContent = 'Following'; assert.equal(verify(), true); } });
  assert.equal(await value.step(ctx), 'acted'); assert.deepEqual(order, ['hover', 'follow']);
  assert.equal(await value.step(ctx), 'empty'); assert.equal(order.indexOf('scroll') > order.indexOf('follow'), true);
  assert.equal(order.filter(x => x === 'hover').length, 1); dom.window.close();
});
test('Binance waits for a delayed profile card instead of clicking a feed button', async () => {
  const { dom, value } = await adapter('content-binance.js', '<main>' + binanceHeader + '<button id="feed">Follow</button></main>', binanceURL);
  let waits = 0, card;
  assert.equal(await value.step(context({ wait: async ms => { if (ms === 250 && ++waits === 3) card = showProfile(dom); }, action: async button => assert.equal(button.closest('.bn-bubble'), card) })), 'acted');
  assert.equal(waits, 3); dom.window.close();
});
test('Binance recognizes a linkless profile card by exact display name and handle', async () => {
  const { dom, value } = await adapter('content-binance.js', binanceHeader, binanceURL);
  let card;
  dom.window.document.querySelector('.nick').addEventListener('mouseover', () => {
    card = dom.window.document.createElement('div'); card.style.position = 'absolute';
    card.innerHTML = '<button>Follow</button><div>Killian Killua</div><div>@killiankillua</div><div>66 Following</div><div>12 Followers</div>';
    dom.window.document.body.append(card);
  }, { once: true });
  assert.equal(await value.step(context({ action: async (button, verify) => { assert.equal(button.parentElement, card); button.textContent = 'Following'; assert.equal(verify(), true); } })), 'acted'); dom.window.close();
});
test('Binance rejects a linkless card with the same name but a different handle', async () => {
  const { dom, value } = await adapter('content-binance.js', binanceHeader + '<div class="bn-bubble"><button>Follow</button><div>Killian Killua</div><div>@someone_else</div></div>', binanceURL);
  assert.equal(await value.step(context()), 'skipped'); dom.window.close();
});
test('Binance recognizes a linkless card with matching name and avatar when handle differs', async () => {
  const avatar = '<a href="/en/square/profile/killiankillua"><img src="https://example.org/avatar.jpg?size=40"></a>';
  const { dom, value } = await adapter('content-binance.js', avatar + binanceHeader, binanceURL);
  let card;
  dom.window.document.querySelector('.nick').addEventListener('mouseover', () => {
    card = dom.window.document.createElement('div'); card.className = 'bn-bubble';
    card.innerHTML = '<img src="https://example.org/avatar.jpg?size=120"><button>Follow</button><div>Killian Killua</div><div>@another_display_handle</div>';
    dom.window.document.body.append(card);
  }, { once: true });
  assert.equal(await value.step(context({ action: async button => assert.equal(button.parentElement, card) })), 'acted'); dom.window.close();
});
test('Binance retries and skips a missing hover card without clicking unrelated buttons', async () => {
  const { dom, value } = await adapter('content-binance.js', '<main>' + binanceHeader + '<button>Follow</button></main>', binanceURL);
  let scrolled = false; dom.window.scrollBy = () => { scrolled = true; };
  let waits = 0; assert.equal(await value.step(context({ wait: async ms => { if (ms === 250) waits++; } })), 'skipped'); assert.equal(waits, 72);
  assert.equal(scrolled, false); dom.window.close();
});
test('Binance recovers when hovering the avatar wrapper on retry opens the card', async () => {
  const { dom, value } = await adapter('content-binance.js', binanceHeader, binanceURL);
  let count = 0, target;
  const avatar = dom.window.document.querySelector('.avatar-name-container');
  avatar.addEventListener('mouseover', event => { count++; if (event.target === avatar) target = showProfile(dom); });
  assert.equal(await value.step(context({ action: async button => assert.equal(button.closest('.bn-bubble'), target) })), 'acted');
  assert.equal(count, 2); dom.window.close();
});
test('Binance stops after three consecutive missing cards instead of scrolling forever', async () => {
  const headers = ['alice', 'bob', 'carol'].map(name => binanceHeader.replaceAll('killiankillua', name)).join('');
  const { dom, value } = await adapter('content-binance.js', headers, binanceURL);
  const ctx = context();
  assert.equal(await value.step(ctx), 'skipped'); assert.equal(await value.step(ctx), 'skipped');
  await assert.rejects(value.step(ctx), /3 consecutive accounts/); dom.window.close();
});
test('Binance skips already-followed users in hover cards', async () => {
  const { dom, value } = await adapter('content-binance.js', binanceHeader, binanceURL);
  dom.window.document.querySelector('.nick').addEventListener('mouseover', () => showProfile(dom, 'killiankillua', true), { once: true });
  assert.equal(await value.step(context()), 'skipped'); dom.window.close();
});
test('Binance cancellation during hover wait prevents a follow', async () => {
  const { dom, value } = await adapter('content-binance.js', binanceHeader, binanceURL);
  let hovered = false;
  dom.window.document.querySelector('.nick').addEventListener('mouseover', () => { hovered = true; });
  await assert.rejects(value.step(context({ wait: async () => { if (hovered) throw Error('Stopped'); } })), /Stopped/); dom.window.close();
});
test('Binance rejects profile pages', async () => {
  const { dom, value } = await adapter('content-binance.js', binanceHeader, binanceURL + '/profile/killiankillua');
  await assert.rejects(value.prepare(), /feed/); dom.window.close();
});
test('Stop cancels an in-flight wait before any click', async () => {
  const dom = new JSDOM('<button>Follow</button>', { url: 'https://x.com/home', runScripts: 'outside-only' });
  let listener, clicks = 0;
  dom.window.chrome = { runtime: { id: 'test', sendMessage: async () => ({ ok: true }), onMessage: { addListener(fn) { listener = fn; } } } };
  dom.window.eval(await readFile(new URL('../extension/content-core.js', import.meta.url), 'utf8'));
  dom.window.PersonalFollow.register({ id: 'x', allowed: () => true, async step(ctx) { await ctx.wait(1000); clicks++; return 'acted'; } });
  listener({ type: 'start', token: 'one', settings: { minDelay: 10, maxDelay: 30 } }, { id: 'test' }, () => {});
  listener({ type: 'stop' }, { id: 'test' }, () => {});
  await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(clicks, 0); dom.window.close();
});

test('uncertain action is counted once, never confirmed, and stops the run', async () => {
  const dom = new JSDOM('<button>Follow</button>', { url: 'https://x.com/home', runScripts: 'outside-only' });
  const messages = []; let listener, clicks = 0;
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.document.querySelector('button').onclick = () => clicks++;
  const timeout = dom.window.setTimeout.bind(dom.window);
  dom.window.setTimeout = fn => timeout(fn, 0);
  dom.window.chrome = { runtime: { id: 'test', sendMessage: async msg => { messages.push(msg); return { ok: true, day: '2026-11-11' }; }, onMessage: { addListener(fn) { listener = fn; } } } };
  dom.window.eval(await readFile(new URL('../extension/content-core.js', import.meta.url), 'utf8'));
  dom.window.PersonalFollow.register({ id: 'x', allowed: () => true, async step(ctx) { await ctx.action(dom.window.document.querySelector('button'), () => false); return 'acted'; } });
  listener({ type: 'start', token: 'one', settings: { minDelay: 10, maxDelay: 30 } }, { id: 'test' }, () => {});
  for (let i = 0; i < 100 && !messages.some(m => m.type === 'status' && m.running === false); i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(clicks, 1); assert.equal(messages.filter(m => m.type === 'reserve').length, 1);
  assert.equal(messages.filter(m => m.type === 'confirmed').length, 0);
  assert.match(messages.find(m => m.type === 'status' && m.running === false).status, /outcome is unclear/);
  dom.window.close();
});
