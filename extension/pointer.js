import { platformFor } from './model.js';

export function createPointer(api) {
  async function validate(tabId) {
    const tab = await api.tabs.get(tabId);
    if (platformFor(tab.url) !== 'binance') throw Error('Browser input is limited to the Binance Square source tab.');
    if (!tab.active) throw Error('Keep the Binance source tab active while running.');
  }
  return {
    async attach(tabId) {
      await validate(tabId);
      try { await api.debugger.attach({ tabId }, '1.3'); }
      catch { throw Error('Cannot enable browser hover. Close DevTools on the Binance tab and check the debugger permission.'); }
    },
    async zoom(tabId) {
      try { const z = await api.tabs.getZoom(tabId); return Number.isFinite(z) && z > 0 ? z : 1; } catch { return 1; }
    },
    async move(tabId, point, factor = 1) {
      await validate(tabId);
      if (!(Number.isFinite(factor) && factor >= 0.25 && factor <= 5)) throw Error('Invalid hover scale.');
      const x = point?.x * factor, y = point?.y * factor;
      if (![x, y].every(n => Number.isFinite(n) && n >= 0 && n <= 20000)) throw Error('Invalid hover coordinates.');
      await api.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0, pointerType: 'mouse' });
    },
    async release(tabId) {
      try { await api.debugger.detach({ tabId }); } catch {}
    }
  };
}
