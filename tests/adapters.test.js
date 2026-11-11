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
test('Binance scopes to feed cards with identifiable profiles and deduplicates users', async () => {
  const { dom, value } = await adapter('content-binance.js', '<main><button id="unrelated">Follow</button><article><a href="/en/square/profile/42">Alice</a><button id="valid">Follow</button></article><article><a href="/en/square/profile/42">Alice</a><button>Follow</button></article></main>', 'https://www.binance.com/en/square');
  const ctx = context({ action: async b => assert.equal(b.id, 'valid') });
  assert.equal(await value.step(ctx), 'acted'); assert.equal(await value.step(ctx), 'empty'); dom.window.close();
});
test('Binance ignores Following buttons and rejects profile pages', async () => {
  const { dom, value } = await adapter('content-binance.js', '<main><article><a href="/en/square/profile/42">Alice</a><button>Following</button></article></main>', 'https://www.binance.com/en/square/profile/42');
  await assert.rejects(value.prepare(), /feed/); assert.equal(await value.step(context()), 'empty'); dom.window.close();
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
