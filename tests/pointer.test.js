import test from 'node:test';
import assert from 'node:assert/strict';
import { createPointer } from '../extension/pointer.js';

test('browser hover only sends mouse movement to an active Square tab', async () => {
  let url = 'https://www.binance.com/en/square', active = true;
  const commands = [];
  const pointer = createPointer({ tabs: { get: async () => ({ url, active }) }, debugger: {
    attach: async (...args) => commands.push(['attach', ...args]),
    sendCommand: async (...args) => commands.push(['command', ...args]),
    detach: async (...args) => commands.push(['detach', ...args])
  } });
  await pointer.attach(7); await pointer.move(7, { x: 150, y: 230 });
  assert.deepEqual(commands[1], ['command', { tabId: 7 }, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: 150, y: 230, button: 'none', buttons: 0, pointerType: 'mouse' }]);
  await assert.rejects(pointer.move(7, { x: NaN, y: 0 }), /coordinates/);
  active = false; await assert.rejects(pointer.move(7, { x: 0, y: 0 }), /active/);
  active = true; url = 'https://www.binance.com/en/trade/BTC_USDT';
  await assert.rejects(pointer.move(7, { x: 0, y: 0 }), /limited/);
  assert.equal(commands.length, 2);
  await pointer.release(7); assert.deepEqual(commands.at(-1), ['detach', { tabId: 7 }]);
});

test('debugger attachment failure stops with an actionable message', async () => {
  const pointer = createPointer({ tabs: { get: async () => ({ active: true, url: 'https://www.binance.com/en/square' }) }, debugger: { attach: async () => { throw Error('Already attached'); } } });
  await assert.rejects(pointer.attach(7), /Close DevTools/);
});
