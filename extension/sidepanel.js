import { defaults, validSettings } from './model.js';

const $ = id => document.getElementById(id);
let selected = 'x', settings = structuredClone(defaults), snapshot, dirty = false;
const uiErrors = {};
const modes = { follow: 'Follow back', massfollow: 'Mass follow · post replies', unfollow: 'Unfollow · bottom to top', unfollow_topdown: 'Unfollow · top to bottom' };
async function ask(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw Error(result?.error || 'Extension connection lost.');
  return result;
}
function renderForm() {
  const values = settings[selected];
  for (const key of ['dailyLimit', 'minDelay', 'maxDelay', 'mode', 'whitelist']) if (values[key] !== undefined) $(key).value = values[key];
  $('personal').checked = settings.x.personal;
  $('x-settings').hidden = $('x-whitelist').hidden = selected !== 'x';
  $('binance-note').hidden = selected === 'x';
  for (const p of ['x', 'binance']) $('settings-' + p).setAttribute('aria-pressed', String(p === selected));
  setSaved(true); $('settings-error').textContent = ''; dirty = false;
}
function setSaved(saved) { $('save-state').textContent = saved ? 'Saved' : 'Unsaved'; $('save-state').classList.toggle('unsaved', !saved); }
function collect() {
  const values = { ...settings[selected] };
  for (const key of ['dailyLimit', 'minDelay', 'maxDelay']) values[key] = Number($(key).value);
  if (selected === 'x') { values.mode = $('mode').value; values.personal = $('personal').checked; values.whitelist = $('whitelist').value; }
  return validSettings(selected, values);
}
async function save() {
  const values = collect();
  await ask({ type: 'save', platform: selected, settings: values });
  settings[selected] = values; dirty = false; setSaved(true); $('settings-error').textContent = '';
}
function renderPlatform(p) {
  const run = snapshot.runs[p], running = !!run?.running;
  const count = snapshot.counts[p]?.day === snapshot.day ? snapshot.counts[p] : { attempts: 0, confirmed: 0 };
  const limit = running ? run.settings.dailyLimit : settings[p].dailyLimit;
  $(p + '-count').textContent = `${count.attempts} / ${limit}`;
  $(p + '-meter').style.width = `${Math.min(100, (count.attempts / limit) * 100 || 0)}%`;
  document.querySelector(`.card[data-platform="${p}"]`).classList.toggle('is-running', running);
  $(p + '-confirmed').textContent = count.confirmed || 0;
  const tab = $(p + '-tab'), chosen = tab.value;
  const candidates = snapshot.tabs.filter(t => t.platform === p);
  const entries = candidates.map(t => [String(t.id), t.title || t.url]);
  if (JSON.stringify(entries) !== tab.dataset.entries) {
    tab.replaceChildren();
    for (const [id, title] of entries.length ? entries : [['', p === 'x' ? 'Open an X tab first' : 'Open the Square feed first']]) { const option = document.createElement('option'); option.value = id; option.textContent = title; tab.append(option); }
    tab.dataset.entries = JSON.stringify(entries);
    if (entries.some(([id]) => id === chosen)) tab.value = chosen;
  }
  if (running) tab.value = String(run.tabId);
  tab.disabled = running;
  $(p + '-start').disabled = running || !tab.value;
  $(p + '-stop').disabled = !running;
  $(p + '-state').textContent = running ? 'Running' : run ? (run.status === 'Stopped' ? 'Stopped' : 'Check tab') : 'Ready';
  $(p + '-state').className = 'chip' + (running ? ' running' : run && run.status !== 'Stopped' ? ' attention' : '');
  $(p + '-status').textContent = uiErrors[p] || run?.status || (p === 'x' ? 'Open the list or post for your selected action.' : 'Open the Square feed. Follows visible feed accounts.');
  $(p + '-timer').textContent = run?.nextAt && running ? `${Math.max(0, Math.ceil((run.nextAt - Date.now()) / 1000))}s` : '';
}
async function refresh() {
  try {
    snapshot = await ask({ type: 'snapshot' });
    settings = snapshot.settings;
    for (const p of ['x', 'binance']) renderPlatform(p);
    $('mode').value = snapshot.runs.x?.running ? snapshot.runs.x.settings.mode : settings.x.mode;
    $('mode').disabled = !!snapshot.runs.x?.running;
    $('x-mode-label').textContent = modes[snapshot.runs.x?.running ? snapshot.runs.x.settings.mode : settings.x.mode];
  } catch (error) { $('settings-error').textContent = error.message; }
}
for (const p of ['x', 'binance']) {
  $('settings-' + p).addEventListener('click', async () => {
    try { if (dirty) await save(); selected = p; renderForm(); } catch (error) { $('settings-error').textContent = error.message; }
  });
  $(p + '-start').addEventListener('click', async () => {
    $(p + '-start').disabled = true;
    try {
      if (dirty) await save();
      await ask({ type: 'start', platform: p, tabId: Number($(p + '-tab').value) });
      delete uiErrors[p];
      await refresh();
    } catch (error) { uiErrors[p] = error.message; $(p + '-status').textContent = error.message; $(p + '-start').disabled = false; }
  });
  $(p + '-stop').addEventListener('click', async () => {
    try { await ask({ type: 'stop', platform: p }); delete uiErrors[p]; await refresh(); } catch (error) { uiErrors[p] = error.message; $(p + '-status').textContent = error.message; }
  });
}
$('settings-form').addEventListener('input', () => { dirty = true; setSaved(false); });
$('mode').addEventListener('change', async () => {
  try { const values = validSettings('x', { ...settings.x, mode: $('mode').value }); await ask({ type: 'save', platform: 'x', settings: values }); settings.x = values; await refresh(); }
  catch (error) { uiErrors.x = error.message; $('x-status').textContent = error.message; }
});
$('settings-form').addEventListener('submit', async event => { event.preventDefault(); try { await save(); await refresh(); } catch (error) { $('settings-error').textContent = error.message; } });
await refresh(); renderForm();
setInterval(refresh, 1500);
