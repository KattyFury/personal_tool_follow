import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey } from '../extension/model.js';

test('background serializes simultaneous reservations and rejects non-owner tabs', async () => {
  let listener;
  const input = [];
  const data = { local: { counts: { binance: { day: dayKey(), attempts: 149, confirmed: 0 } } }, session: {} };
  const storage = key => ({ get: async () => structuredClone(data[key]), set: async next => { await new Promise(resolve => setTimeout(resolve, 2)); Object.assign(data[key], structuredClone(next)); } });
  globalThis.chrome = {
    sidePanel: { setPanelBehavior: async value => { assert.equal(value.openPanelOnActionClick, true); } },
    runtime: { getURL: () => 'chrome-extension://test/sidepanel.html', onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: storage('local'), session: storage('session') },
    action: { onClicked: { addListener() {} } },
    debugger: { attach: async target => input.push(['attach', target]), detach: async target => input.push(['detach', target]), sendCommand: async (...args) => input.push(['command', ...args]), onDetach: { addListener() {} } },
    tabs: { onRemoved: { addListener() {} }, onUpdated: { addListener() {} }, update: async () => {}, get: async id => ({ id, active: true, url: 'https://www.binance.com/en/square' }), sendMessage: async () => ({ ok: true }) }
  };
  await import('../extension/background.js?test');
  const request = (msg, sender) => new Promise(resolve => listener(msg, sender, resolve));
  assert.equal((await request({ type: 'start', platform: 'binance', tabId: 7 }, { url: 'chrome-extension://test/sidepanel.html' })).ok, true);
  const token = data.session.runs.binance.token;
  const owner = { tab: { id: 7, url: 'https://www.binance.com/en/square' } };
  assert.equal((await request({ type: 'movePointer', platform: 'binance', token, point: { x: 100, y: 200 } }, owner)).ok, true);
  assert.equal(input[1][2], 'Input.dispatchMouseEvent');
  assert.equal((await request({ type: 'movePointer', platform: 'binance', token, point: { x: 100, y: 200 } }, { tab: { id: 8, url: owner.tab.url } })).ok, false);
  assert.equal((await request({ type: 'movePointer', platform: 'binance', token, point: { x: 100, y: 200 } }, { ...owner, frameId: 1 })).ok, false);
  const replies = await Promise.all([1, 2].map(() => request({ type: 'reserve', platform: 'binance', token }, owner)));
  assert.equal(replies.filter(r => r.ok).length, 1); assert.equal(data.local.counts.binance.attempts, 150);
  assert.equal((await request({ type: 'reserve', platform: 'binance', token }, { tab: { id: 8, url: owner.tab.url } })).ok, false);
  assert.equal((await request({ type: 'start', platform: 'binance', tabId: 8 }, { url: 'chrome-extension://test/sidepanel.html' })).ok, false);
  await request({ type: 'stop', platform: 'binance' }, { url: 'chrome-extension://test/sidepanel.html' });
  assert.equal(input.at(-1)[0], 'detach');
  assert.equal((await request({ type: 'movePointer', platform: 'binance', token, point: { x: 100, y: 200 } }, owner)).ok, false);
  assert.equal((await request({ type: 'reserve', platform: 'binance', token }, owner)).error, 'Run has stopped.');
  assert.equal((await request({ type: 'status', platform: 'binance', token, running: true, status: 'late' }, owner)).ok, false);
  assert.equal(data.session.runs.binance.running, false);
  assert.equal((await request({ type: 'reserve', platform: 'binance', token: 'stale' }, owner)).ok, false);
  delete globalThis.chrome;
});
