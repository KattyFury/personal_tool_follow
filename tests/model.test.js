import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, validSettings, reserveCount, dayKey, platformFor } from '../extension/model.js';
import { readFile } from 'node:fs/promises';

test('extension uses the native Chrome sidebar', async () => {
  const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
  assert.ok(manifest.permissions.includes('sidePanel'));
  assert.equal(manifest.side_panel.default_path, 'sidepanel.html');
  assert.equal(manifest.action.default_popup, undefined);
  const background = await readFile(new URL('../extension/background.js', import.meta.url), 'utf8');
  assert.ok(background.includes('openPanelOnActionClick: true'));
  assert.ok(!background.includes('chrome.tabs.create'));
});

test('defaults keep X timing and Binance requested timing separate', () => {
  assert.deepEqual([defaults.x.dailyLimit, defaults.x.minDelay, defaults.x.maxDelay], [400, 60, 90]);
  assert.deepEqual([defaults.binance.dailyLimit, defaults.binance.minDelay, defaults.binance.maxDelay, defaults.binance.mode], [150, 60, 90, 'feed']);
  assert.throws(() => validSettings('binance', { mode: 'nope' }));
});
test('Vietnam midnight resets counters without changing prior data', () => {
  assert.equal(dayKey(new Date('2026-11-11T16:59:59Z')), '2026-11-11');
  assert.equal(dayKey(new Date('2026-11-11T17:00:00Z')), '2026-11-12');
  const previous = { day: '2026-11-11', attempts: 500, confirmed: 499 };
  assert.deepEqual(reserveCount(previous, 500, new Date('2026-11-11T17:00:00Z')), { day: '2026-11-12', attempts: 1, confirmed: 0 });
  assert.equal(previous.attempts, 500);
});
test('cap is enforced before another attempt is reserved', () => {
  const date = new Date('2026-11-11T10:00:00Z');
  const last = reserveCount({ day: dayKey(date), attempts: 499, confirmed: 498 }, 500, date);
  assert.equal(last.attempts, 500);
  assert.throws(() => reserveCount(last, 500, date), /cap reached/);
});
test('settings reject invalid limits and inverted timing', () => {
  for (const dailyLimit of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => validSettings('binance', { dailyLimit }));
  assert.throws(() => validSettings('binance', { minDelay: 30, maxDelay: 10 }));
  const x = validSettings('x', { restMin: 12, restMax: 1 });
  assert.equal('restMin' in x || 'restMax' in x, false);
  assert.equal(validSettings('x', { whitelist: '@alice, ALICE, bob, <img>' }).whitelist, 'alice, bob');
});
test('only X and Square routes are eligible', () => {
  assert.equal(platformFor('https://x.com/home'), 'x');
  assert.equal(platformFor('https://www.binance.com/en/square'), 'binance');
  assert.equal(platformFor('https://www.binance.com/vi/square/profile/123'), 'binance');
  for (const url of ['https://www.binance.com/en/trade/BTC_USDT', 'https://evil.com/square', 'http://x.com/home']) assert.equal(platformFor(url), null);
});
test('Binance comment settings default off and validate text and cap', () => {
  assert.deepEqual([defaults.binance.comment, defaults.binance.commentText, defaults.binance.commentLimit], [false, 'Please follow me back', 30]);
  assert.equal(validSettings('binance', { comment: true, commentText: '  Please   follow me back ' }).commentText, 'Please follow me back');
  assert.throws(() => validSettings('binance', { comment: true, commentText: '   ' }), /comment text/i);
  assert.throws(() => validSettings('binance', { commentText: 'x'.repeat(281) }), /280/);
  assert.throws(() => validSettings('binance', { commentLimit: 0 }), /Comment cap/);
});
test('Binance comment settings keep one comment per line, at most 20', () => {
  assert.equal(validSettings('binance', { comment: true, commentText: ' Hi  there \n\n Follow back pls \r\n' }).commentText, 'Hi there\nFollow back pls');
  assert.throws(() => validSettings('binance', { commentText: Array(21).fill('a').join('\n') }), /at most 20/);
});
