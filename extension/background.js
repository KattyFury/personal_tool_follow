import { defaults, dayKey, validSettings, reserveCount, platformFor } from './model.js';
import { createPointer } from './pointer.js';

const pointer = createPointer(chrome);

let queue = Promise.resolve();
const serial = fn => { const next = queue.then(fn); queue = next.catch(() => {}); return next; };
const panelURL = chrome.runtime.getURL('sidepanel.html');
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(error => console.error(error));

async function read() {
  const value = await chrome.storage.local.get(['settings', 'counts']);
  return { settings: { x: { ...defaults.x, ...value.settings?.x }, binance: { ...defaults.binance, ...value.settings?.binance } }, counts: value.counts || {} };
}
async function sessions() { return (await chrome.storage.session.get('runs')).runs || {}; }
async function storeRuns(runs) { await chrome.storage.session.set({ runs }); }
const send = (id, message) => chrome.tabs.sendMessage(id, message);

async function handle(message, sender) {
  const p = message.platform;
  if (sender.tab) {
    if (platformFor(sender.tab.url) !== p) throw Error('Unsupported page.');
    const runs = await sessions(), run = runs[p];
    if (message.type === 'hello') {
      if (run?.tabId === sender.tab.id) { delete runs[p]; await storeRuns(runs); if (p === 'binance') await pointer.release(run.tabId); }
      return { ok: true };
    }
    if (!run || run.tabId !== sender.tab.id || run.token !== message.token) throw Error('Run has stopped.');
    if (message.type === 'movePointer') {
      if (p !== 'binance' || !run.running || (sender.frameId || 0) !== 0) throw Error('Browser hover is unavailable for this request.');
      await pointer.move(run.tabId, message.point);
      return { ok: true };
    }
    if (message.type === 'reserve') {
      if (!run.running) throw Error('Run has stopped.');
      const state = await read();
      state.counts[p] = reserveCount(state.counts[p], run.settings.dailyLimit);
      await chrome.storage.local.set({ counts: state.counts });
      return { ok: true, count: state.counts[p].attempts, day: state.counts[p].day };
    }
    if (message.type === 'confirmed') {
      const state = await read(), count = state.counts[p];
      if (count && count.day === message.day) { count.confirmed = Math.min(count.attempts, (count.confirmed || 0) + 1); await chrome.storage.local.set({ counts: state.counts }); }
      return { ok: true };
    }
    if (message.type === 'status') {
      if (!run.running && message.running) throw Error('Run has stopped.');
      Object.assign(run, { status: String(message.status).slice(0, 240), nextAt: message.nextAt || null, running: !!message.running });
      await storeRuns(runs);
      if (!run.running && p === 'binance') await pointer.release(run.tabId);
      return { ok: true };
    }
    throw Error('Unsupported content request.');
  }
  if (sender.url !== panelURL) throw Error('Open the sidebar.');
  if (message.type === 'snapshot') {
    const state = await read(), runs = await sessions(), tabs = await chrome.tabs.query({});
    for (const [key, run] of Object.entries(runs)) if (!tabs.some(t => t.id === run.tabId && platformFor(t.url) === key)) {
      delete runs[key];
      if (key === 'binance') await pointer.release(run.tabId);
    }
    await storeRuns(runs);
    return { ok: true, ...state, runs, day: dayKey(), tabs: tabs.filter(t => platformFor(t.url)).map(t => ({ id: t.id, platform: platformFor(t.url), title: t.title, url: t.url })) };
  }
  if (!defaults[p]) throw Error('Unknown platform.');
  if (message.type === 'save') {
    const state = await read(); state.settings[p] = validSettings(p, message.settings);
    await chrome.storage.local.set({ settings: state.settings });
    return { ok: true };
  }
  if (message.type === 'start') {
    const runs = await sessions();
    if (runs[p]?.running) throw Error('This platform is already running.');
    const tab = await chrome.tabs.get(message.tabId);
    if (platformFor(tab.url) !== p) throw Error('Select an open platform tab.');
    const state = await read(), settings = validSettings(p, state.settings[p]);
    if (state.counts[p]?.day === dayKey() && state.counts[p].attempts >= settings.dailyLimit) throw Error('Daily cap reached.');
    const token = crypto.randomUUID();
    runs[p] = { tabId: tab.id, token, running: true, status: 'Starting…', settings };
    try {
      if (p === 'binance') {
        await chrome.tabs.update(tab.id, { active: true });
        await pointer.attach(tab.id);
      }
      await storeRuns(runs);
      const reply = await send(tab.id, { type: 'start', token, settings });
      if (!reply?.ok) throw Error(reply?.error || 'Unable to start.');
    } catch (error) { delete runs[p]; await storeRuns(runs); if (p === 'binance') await pointer.release(tab.id); throw Error(error.message + ' Refresh the platform tab after installing or reloading the extension.'); }
    return { ok: true };
  }
  if (message.type === 'stop') {
    const runs = await sessions(), run = runs[p];
    if (!run) return { ok: true };
    run.running = false; run.status = 'Stopped'; run.nextAt = null;
    try { await send(run.tabId, { type: 'stop' }); } catch {}
    await storeRuns(runs);
    if (p === 'binance') await pointer.release(run.tabId);
    return { ok: true };
  }
  throw Error('Unknown request.');
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  serial(() => handle(message, sender)).then(respond, error => respond({ ok: false, error: error.message }));
  return true;
});
chrome.tabs.onRemoved.addListener(id => serial(async () => {
  const runs = await sessions();
  for (const p of Object.keys(runs)) if (runs[p].tabId === id) delete runs[p];
  await storeRuns(runs);
}));
chrome.tabs.onUpdated.addListener((id, change) => {
  if (!change.url && change.status !== 'loading') return;
  serial(async () => {
    const runs = await sessions(), run = runs.binance;
    if (!run || run.tabId !== id) return;
    run.running = false; run.nextAt = null; run.status = 'Page changed. Start again after it loads.';
    await storeRuns(runs);
    try { await send(id, { type: 'stop' }); } catch {}
    await pointer.release(id);
  });
});
chrome.debugger.onDetach.addListener(source => serial(async () => {
  const runs = await sessions(), run = runs.binance;
  if (!run?.running || run.tabId !== source.tabId) return;
  run.running = false; run.nextAt = null; run.status = 'Browser hover disconnected. Close DevTools and start again.';
  await storeRuns(runs);
  try { await send(run.tabId, { type: 'stop' }); } catch {}
}));
