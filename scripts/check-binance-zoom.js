import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createPointer } from '../extension/pointer.js';

const ZOOM = 1.25;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.route('http://127.0.0.1:4174/**', route => route.fulfill({ contentType: 'text/html', body: `
    <style>.nick-username { margin:100px; position:relative; width:200px; } .fixture-card { display:none; position:absolute; top:25px; width:240px; padding:20px; background:white; } .nick-username:hover .fixture-card { display:block; }</style>
    <div class="card__hd-wrapper"><div class="card__hd"><div class="avatar-name-container"><div class="nick-username"><a href="/en/square/profile/fixture">Fixture Person</a><div class="fixture-card bn-bubble"><a href="/en/square/profile/fixture">Fixture Person</a><button onclick="this.textContent='Following'">Follow</button></div></div></div></div></div>` }));
  await page.goto('http://127.0.0.1:4174/en/square');
  const session = await page.context().newCDPSession(page);
  const messages = [];
  const pointer = createPointer({ tabs: { get: async () => ({ active: true, url: 'https://www.binance.com/en/square' }) }, debugger: { sendCommand: async (target, method, params) => session.send(method, params) } });
  await page.exposeFunction('fixtureBridge', async message => {
    messages.push(message);
    // Simulate a tab zoomed to 125%: the page's CSS px are 1.25x smaller than the debugger's coordinate space.
    if (message.type === 'movePointer') { await pointer.move(7, { x: message.point.x / ZOOM, y: message.point.y / ZOOM }, message.factor ?? 1); return { ok: true, zoom: ZOOM }; }
    return { ok: true, count: 1, day: '2026-11-11' };
  });
  await page.evaluate(() => {
    window.chrome = { runtime: { id: 'fixture', sendMessage: message => window.fixtureBridge(message), onMessage: { addListener(fn) { window.runnerMessage = fn; } } } };
    window.hoverEvents = [];
    document.querySelector('.nick-username').addEventListener('mouseover', event => hoverEvents.push(event.isTrusted));
  });
  for (const name of ['content-core.js', 'content-binance.js']) await page.addScriptTag({ content: await readFile(new URL('../extension/' + name, import.meta.url), 'utf8') });
  await page.evaluate(() => window.runnerMessage({ type: 'start', token: 'fixture-run', settings: { dailyLimit: 1, minDelay: 10, maxDelay: 30 } }, { id: 'fixture' }, () => {}));
  for (let i = 0; i < 100 && !messages.some(message => message.type === 'status' && message.running === false); i++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(messages.filter(message => message.type === 'confirmed').length, 1, JSON.stringify(messages.filter(message => message.type === 'status')));
  assert.equal(messages.filter(message => message.type === 'reserve').length, 1);
  assert.ok((await page.evaluate(() => hoverEvents)).includes(true));
  assert.equal(messages.find(message => message.type === 'status' && message.running === false).status, 'Daily cap reached.');
  assert.ok(messages.some(m => m.type === 'movePointer' && m.factor === ZOOM), 'calibration did not switch to the zoom factor');
  console.log('Zoom calibration verified: with a simulated 125% tab zoom the first pointer move misses, the runner recalibrates to x1.25, opens a CSS-hover-only profile card, follows fixture account once, confirms it, and stops at cap. No live site/account was accessed.');
} finally { await browser.close(); }
