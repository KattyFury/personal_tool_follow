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
  return { settings: { mode: 'follow', personal: true, whitelist: '' }, seen: new Set(), check() {}, wait: async () => {}, report: async () => {}, hover: async el => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('mouseover', { bubbles: true })), unhover: async () => {}, action: async () => { throw Error('Unexpected action'); }, ...overrides };
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

const xPost = 'https://x.com/someone/status/123';
const xReply = handle => `<article data-testid="tweet"><div data-testid="User-Name"><a href="/${handle}">${handle}</a><svg data-testid="icon-verified"></svg></div><a href="/${handle}/status/999"><time></time></a><p>reply</p></article>`;
const xCard = (dom, handle, label = 'Follow') => { const card = dom.window.document.createElement('div'); card.dataset.testid = 'HoverCard'; card.innerHTML = `<a href="/${handle}">${handle}</a><button>${label}</button>`; dom.window.document.body.append(card); return card; };
test('X mass follow hovers the replier name with the real pointer and follows from the matching hover card', async () => {
  const { dom, value } = await adapter('content-x.js', '<main><button>Follow</button>' + xReply('alice') + '</main>', xPost);
  const order = []; let card;
  xCard(dom, 'someone_else');
  const ctx = context({ settings: { mode: 'massfollow', personal: false, whitelist: '' },
    hover: async el => { order.push('hover:' + el.getAttribute('href')); card ??= xCard(dom, 'alice'); },
    unhover: async () => order.push('unhover'),
    action: async (button, verify) => { assert.equal(button.closest('[data-testid="HoverCard"]'), card); order.push('follow'); button.textContent = 'Following'; assert.equal(verify(), true); } });
  assert.equal(await value.step(ctx), 'acted');
  assert.deepEqual(order, ['hover:/alice', 'follow', 'unhover']); dom.window.close();
});
test('X mass follow skips when no hover card appears and never clicks other Follow buttons', async () => {
  const { dom, value } = await adapter('content-x.js', '<main><button>Follow</button>' + xReply('bob') + '</main>', xPost);
  let hovers = 0;
  const ctx = context({ settings: { mode: 'massfollow', personal: false, whitelist: '' }, hover: async () => { hovers++; } });
  assert.equal(await value.step(ctx), 'skipped'); assert.equal(hovers, 2); dom.window.close();
});
test('X mass follow skips accounts already followed in the hover card', async () => {
  const { dom, value } = await adapter('content-x.js', xReply('carol'), xPost);
  const ctx = context({ settings: { mode: 'massfollow', personal: false, whitelist: '' }, hover: async () => { xCard(dom, 'carol', 'Following'); } });
  assert.equal(await value.step(ctx), 'skipped'); dom.window.close();
});

test('X mass follow runs on the Home feed and refuses account lists', async () => {
  const { dom, value } = await adapter('content-x.js', xReply('dave') + xReply('erin'), 'https://x.com/home');
  const ctx = context({ settings: { mode: 'massfollow', personal: false, whitelist: '' }, hover: async el => { xCard(dom, el.getAttribute('href').slice(1)); },
    action: async (button, verify) => { button.textContent = 'Following'; assert.equal(verify(), true); } });
  assert.equal(value.allowed(ctx.settings), true);
  await value.prepare(ctx);
  assert.equal(await value.step(ctx), 'acted'); assert.equal(await value.step(ctx), 'acted');
  dom.window.close();
  const list = await adapter('content-x.js', '', 'https://x.com/someone/following');
  assert.equal(list.value.allowed({ mode: 'massfollow' }), false);
  await assert.rejects(list.value.prepare(context({ settings: { mode: 'massfollow', personal: false, whitelist: '' } })), /Home feed/);
  list.dom.window.close();
});

const followerRow = (name, label) => `<div data-avatar="x"><div class="avatar-name-container"><a href="/en/square/profile/${name}" class="avatar-box"></a><div class="nick-username"><a href="/en/square/profile/${name}" class="nick">${name}</a></div></div><div><button><div><span>${label}</span></div></button></div></div>`;
test('Binance follow back clicks the Follow button of followers not yet followed, without hover', async () => {
  const url = 'https://www.binance.com/en/square/profile/0xhieu/followers';
  const { dom, value } = await adapter('content-binance.js', '<main>' + followerRow('alice', 'Following') + followerRow('bob', 'Follow') + followerRow('carol', 'Follow') + '</main>', url);
  dom.window.scrollTo = () => {};
  const settings = { mode: 'followback' }, clicked = [];
  assert.equal(value.allowed(settings), true); assert.equal(value.allowed({ mode: 'feed' }), false);
  await value.prepare({ settings });
  const ctx = context({ settings, hover: async () => { throw Error('No hover in follow back'); }, action: async (button, verify) => { clicked.push(button.closest('[data-avatar]').querySelector('.nick').textContent); button.querySelector('span').textContent = 'Following'; assert.equal(verify(), true); } });
  assert.equal(await value.step(ctx), 'acted'); assert.equal(await value.step(ctx), 'acted'); assert.equal(await value.step(ctx), 'empty');
  assert.deepEqual(clicked, ['bob', 'carol']); dom.window.close();
  const feed = await adapter('content-binance.js', '', binanceURL);
  await assert.rejects(feed.value.prepare({ settings }), /list of accounts/i); feed.dom.window.close();
});
test('Binance follow from list also runs on Following > Suggested to you, any Square page with account rows', async () => {
  const { dom, value } = await adapter('content-binance.js', '<main>' + followerRow('dave', 'Follow') + followerRow('erin', 'Following') + '</main>', 'https://www.binance.com/en/square/following');
  dom.window.scrollTo = () => {};
  const settings = { mode: 'followback' }, clicked = [];
  assert.equal(value.allowed(settings), true); assert.equal(value.allowed({ mode: 'feed' }), false);
  await value.prepare({ settings });
  const ctx = context({ settings, action: async (button, verify) => { clicked.push(button.closest('[data-avatar]').querySelector('.nick').textContent); button.querySelector('span').textContent = 'Following'; assert.equal(verify(), true); } });
  assert.equal(await value.step(ctx), 'acted'); assert.equal(await value.step(ctx), 'empty');
  assert.deepEqual(clicked, ['dave']); dom.window.close();
  const other = await adapter('content-binance.js', '<main>' + followerRow('dave', 'Follow') + '</main>', 'https://www.binance.com/en/markets');
  assert.equal(other.value.allowed(settings), false); other.dom.window.close();
});

const whoCell = (handle, sf, { round = true, gold = false } = {}) => `<div data-testid="UserCell"><div data-testid="UserAvatar-Container-${handle}"><a href="/${handle}"><div style="border-radius:${round ? '9999px' : '0px'}"></div></a></div><span class="signal-avatar-badge__value">${sf}</span><a href="/${handle}">${handle}</a>${gold ? '<svg data-testid="icon-verified"><linearGradient></linearGradient></svg>' : ''}<button data-testid="1-follow">Theo dõi</button></div>`;
test('X mass follow on Who to follow clicks people with SF > 10 directly, skipping projects and low SF', async () => {
  const html = whoCell('project', '500', { round: false, gold: true }) + whoCell('squareorg', '90', { round: false }) + whoCell('lowsf', '10') + whoCell('nosf', 'N/A') + whoCell('alice', '1,346');
  const { dom, value } = await adapter('content-x.js', html, 'https://x.com/i/connect_people?show_topics=false');
  const settings = { mode: 'massfollow', personal: true, whitelist: '' }, clicked = [];
  assert.equal(value.allowed(settings), true); await value.prepare(context({ settings }));
  const ctx = context({ settings, hover: async () => { throw Error('No hover on Who to follow'); }, action: async (button, verify) => { clicked.push(button.closest('[data-testid="UserCell"]').querySelector('a').getAttribute('href')); button.textContent = 'Đang theo dõi'; assert.equal(verify(), true); } });
  assert.equal(await value.step(ctx), 'acted'); assert.equal(await value.step(ctx), 'empty');
  assert.deepEqual(clicked, ['/alice']); dom.window.close();
});
test('X recognises the Vietnamese "xác nhận" verified label', async () => {
  const { dom, value } = await adapter('content-x.js', '<article data-testid="tweet"><div data-testid="User-Name"><a href="/vn">vn</a><svg aria-label="Tài khoản đã xác nhận"></svg></div></article>', 'https://x.com/home');
  let hovered = false;
  await value.step(context({ settings: { mode: 'massfollow', personal: false, whitelist: '' }, hover: async () => { hovered = true; } }));
  assert.equal(hovered, true); dom.window.close();
});

// 0.7.0: comment after follow. Composer markup mirrors the live Square reply modal (checked read-only 2026-11-12).
const feedCard = name => `<div class="card-content-box">${binanceHeader.replaceAll('killiankillua', name)}<div class="card__ft"><div class="comments-icon"><div class="cursor-pointer">2</div></div></div></div>`;
function installComposer(dom, nick, { closesOnReply = true } = {}) {
  const doc = dom.window.document;
  doc.execCommand = (cmd, _ui, value) => { const ed = doc.activeElement; if (cmd === 'insertText') ed.textContent += value; if (cmd === 'delete') ed.textContent = ''; ed.dispatchEvent(new dom.window.Event('input', { bubbles: true })); return true; };
  doc.querySelector('.comments-icon .cursor-pointer').addEventListener('click', () => {
    const host = doc.createElement('div'); host.className = 'short-editor';
    host.innerHTML = `<div class="short-editor-inner modal"><div><svg></svg></div><div class="nick">${nick}</div><div class="tiptap ProseMirror" contenteditable="true" role="textbox" tabindex="0"></div><button class="inactive">Reply</button></div>`;
    const ed = host.querySelector('.ProseMirror'), reply = host.querySelector('button');
    ed.addEventListener('input', () => reply.classList.toggle('inactive', !ed.textContent));
    reply.addEventListener('click', () => { host.posted = ed.textContent; if (closesOnReply) host.remove(); });
    host.querySelector('svg').addEventListener('click', () => host.remove());
    doc.body.append(host); dom.window.lastComposer = host;
  });
}
const commentSettings = { mode: 'feed', comment: true, commentText: 'Please follow me back', commentLimit: 30 };
const followCtx = (dom, extra = {}) => context({ settings: commentSettings, hover: async () => { showProfile(dom); }, action: async (button, verify) => { button.textContent = 'Following'; assert.equal(verify(), true); }, ...extra });
test('Binance comments on the followed author post after a new follow', async () => {
  const { dom, value } = await adapter('content-binance.js', feedCard('killiankillua'), binanceURL);
  installComposer(dom, 'Killian Killua');
  const asked = [];
  assert.equal(await value.step(followCtx(dom, { ask: async m => { asked.push(m.type); return { ok: true, day: 'd' }; } })), 'acted');
  assert.equal(dom.window.lastComposer.posted, 'Please follow me back');
  assert.deepEqual(asked, ['reserveComment', 'commentConfirmed']); dom.window.close();
});
test('Binance skips the comment when comments are off or the composer shows another author', async () => {
  let { dom, value } = await adapter('content-binance.js', feedCard('killiankillua'), binanceURL);
  installComposer(dom, 'Killian Killua');
  assert.equal(await value.step(followCtx(dom, { settings: { ...commentSettings, comment: false }, ask: async () => { throw Error('no comment expected'); } })), 'acted');
  assert.equal(dom.window.lastComposer, undefined); dom.window.close();
  ({ dom, value } = await adapter('content-binance.js', feedCard('killiankillua'), binanceURL));
  installComposer(dom, 'Someone Else');
  assert.equal(await value.step(followCtx(dom, { ask: async () => { throw Error('no reservation expected'); } })), 'acted');
  assert.equal(dom.window.lastComposer.posted, undefined); assert.equal(dom.window.lastComposer.isConnected, false); dom.window.close();
});
test('Binance keeps following without commenting once the comment cap is reached', async () => {
  const { dom, value } = await adapter('content-binance.js', feedCard('killiankillua'), binanceURL);
  installComposer(dom, 'Killian Killua');
  const reports = [];
  assert.equal(await value.step(followCtx(dom, { ask: async () => { throw Error('Daily cap reached.'); }, report: async s => reports.push(s) })), 'acted');
  assert.equal(dom.window.lastComposer.posted, undefined); assert.equal(dom.window.lastComposer.isConnected, false);
  assert.ok(reports.some(s => /comment cap/i.test(s))); dom.window.close();
});
test('Binance stops when a submitted comment does not clear', async () => {
  const { dom, value } = await adapter('content-binance.js', feedCard('killiankillua'), binanceURL);
  installComposer(dom, 'Killian Killua', { closesOnReply: false });
  dom.window.document.querySelector('.comments-icon .cursor-pointer').addEventListener('click', () => { dom.window.lastComposer.querySelector('button').addEventListener('click', e => e.stopImmediatePropagation(), { capture: true }); });
  await assert.rejects(value.step(followCtx(dom, { ask: async () => ({ ok: true, day: 'd' }) })), /Comment outcome is unclear/); dom.window.close();
});
test('Binance uses the comment lines in turn across follows', async () => {
  const names = ['alice', 'bob', 'carol'];
  const { dom, value } = await adapter('content-binance.js', names.map(feedCard).join(''), binanceURL);
  const doc = dom.window.document, posted = [];
  doc.execCommand = (cmd, _ui, v) => { const ed = doc.activeElement; if (cmd === 'insertText') ed.textContent += v; if (cmd === 'delete') ed.textContent = ''; ed.dispatchEvent(new dom.window.Event('input', { bubbles: true })); return true; };
  doc.querySelectorAll('.card-content-box').forEach(box => box.querySelector('.comments-icon .cursor-pointer').addEventListener('click', () => {
    const host = doc.createElement('div'); host.className = 'short-editor';
    host.innerHTML = `<div class="short-editor-inner modal"><div><svg></svg></div><div class="nick">${box.querySelector('a.nick').textContent}</div><div class="ProseMirror" contenteditable="true" role="textbox"></div><button>Reply</button></div>`;
    host.querySelector('button').addEventListener('click', () => { posted.push(host.querySelector('.ProseMirror').textContent); host.remove(); });
    doc.body.append(host);
  }));
  dom.window.Math.random = () => 0;
  const settings = { ...commentSettings, commentText: 'First\nSecond' };
  await value.prepare({ settings });
  const ctx = context({ settings, hover: async el => { const a = el.closest('.card-content-box').querySelector('a.nick'); showProfile(dom, a.getAttribute('href').split('/').pop()); }, action: async (button, verify) => { button.textContent = 'Following'; assert.equal(verify(), true); }, ask: async () => ({ ok: true, day: 'd' }) });
  for (let i = 0; i < 3; i++) assert.equal(await value.step(ctx), 'acted');
  assert.deepEqual(posted, ['First', 'Second', 'First']); dom.window.close();
});
