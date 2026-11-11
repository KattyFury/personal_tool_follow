// ==UserScript==
// @name         X Manager
// @namespace    http://tampermonkey.net/
// @version      4.10.0
// @description  Auto follow / unfollow / mass-follow verified on X
// @author       KattyFury
// @match        https://twitter.com/*
// @match        https://x.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
  'use strict';

  const CFG = { minDelay: 60_000, maxDelay: 90_000, restMin: 5 * 60_000, restMax: 10 * 60_000, scrollPause: 2_000, dailyLimit: 400 };
  const DELAY_KEY = 'xfm_delay';
  try { Object.assign(CFG, JSON.parse(localStorage.getItem(DELAY_KEY) || '{}')); } catch {}

  const WL_KEY = 'xfm_whitelist';
  const DEFAULT_WL = [
    'arc','tempo','ritualnet','seismicsys','base','megaeth','metamask',
    'kastxyz','degentokenbase','01exchange','decibeltrade','linera_io',
    'somnia_network','relayprotocol','jumperapp','prismaxai','axisrobotics',
    'psdnai','nansen_ai','ethos_network','wallchain','forteprotocol',
    'upshot_cards','megapot','spektergames','pixiechess','integra_layer',
    'getoro_xyz','farcaster_xyz','bluesky','stormrae_ai','concretexyz',
    'ezwalletapp','kucoincom','bybit_official','binanceangels','riverdotinc',
    'river4fun','binance','bitget','arcium','bybitafrica','binancevip',
  ];
  const getWL  = () => { try { return [...new Set(JSON.parse(localStorage.getItem(WL_KEY) || '[]'))]; } catch { return []; } };
  const saveWL = l => localStorage.setItem(WL_KEY, JSON.stringify([...new Set(l)]));
  if (!getWL().length) saveWL(DEFAULT_WL);

  function parseHandles(text) {
    return text.split(/[\s,\n]+/).map(s => s.replace(/^@/, '').trim().toLowerCase()).filter(h => /^[a-z0-9_]+$/i.test(h));
  }
  function addToWL(raw) {
    const handles = parseHandles(raw);
    if (!handles.length) return false;
    const list = getWL(), newOnes = handles.filter(h => !list.includes(h));
    if (!newOnes.length) return false;
    saveWL([...list, ...newOnes]); return true;
  }
  const removeFromWL = handle => saveWL(getWL().filter(h => h !== handle.toLowerCase()));
  function isWhitelisted(cell) {
    const list = getWL(); if (!list.length) return false;
    const link = cell.querySelector('a[href^="/"]'); if (!link) return false;
    const handle = link.getAttribute('href').replace('/', '').toLowerCase();
    return list.some(h => handle === h || handle.startsWith(h));
  }

  let running = false, mode = 'follow', timer = null, tickInterval = null, statusMsg = 'Sẵn sàng';

  const STORAGE_KEY = 'xfm_daily';
  const todayKey = () => new Date().toISOString().slice(0, 10);
  function getDailyCount() {
    try { const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); return d.date === todayKey() ? (d.count || 0) : 0; } catch { return 0; }
  }
  function incrementDaily() {
    try { const c = getDailyCount() + 1; localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), count: c })); return c; } catch { return 0; }
  }
  const updateDailyDisplay = () => { const el = document.getElementById('xfm-daily'); if (el) el.textContent = `${getDailyCount()}/${CFG.dailyLimit}`; };

  const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function log(msg) { statusMsg = msg; const el = document.getElementById('xfm-status'); if (el) el.textContent = msg; }
  const updateTimer = s => { const el = document.getElementById('xfm-timer'); if (el) el.textContent = s > 0 ? `${s}s` : ''; };

  function getBtnText(btn) {
    const spans = [...btn.querySelectorAll('span')].filter(s => !s.querySelector('span'));
    const t = spans.map(s => s.textContent.trim()).filter(Boolean);
    return t[0] || btn.getAttribute('aria-label')?.trim() || btn.textContent.trim().split('\n')[0].trim();
  }
  function isFollowBtn(btn) {
    const tl = getBtnText(btn).toLowerCase();
    return ['follow','theo dõi'].some(f => tl.includes(f)) && !['following','đang theo dõi','unfollow','bỏ'].some(f => tl.includes(f));
  }
  function isFollowingBtn(btn) {
    const tl = getBtnText(btn).toLowerCase(), aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    return ['following','đang theo dõi'].some(f => tl.includes(f)) || aria.includes('following');
  }
  function isUnfollowBtn(btn) {
    const tl = getBtnText(btn).toLowerCase(), aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    return ['unfollow','bỏ theo dõi'].some(f => tl.includes(f)) || aria.includes('unfollow');
  }
  const cellFollowsYou = cell => ['Follows you','Theo dõi bạn'].some(t => (cell.textContent || '').includes(t));
  const isAd = el => ['Promoted','Quảng cáo','Được quảng bá'].some(t => (el.textContent || '').includes(t));
  function triggerHover(el) {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    ['mouseover','mouseenter','mousemove'].forEach(n => el.dispatchEvent(new MouseEvent(n, { bubbles: true, cancelable: true, clientX: cx, clientY: cy })));
  }
  function hasVerifiedBadge(el) {
    return !!(el.querySelector('svg[aria-label="Verified account"]') ||
              el.querySelector('svg[aria-label="Tài khoản đã xác minh"]') ||
              el.querySelector('[data-testid="icon-verified"]') ||
              el.querySelector('[data-testid="verifiedIcon"]'));
  }
  const cellHandle = cell => (cell.querySelector('a[href^="/"]')?.getAttribute('href') || '').slice(1);
  async function focusCell(cell) {
    cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(rand(600, 900));
    return cell.isConnected;
  }

  const MF_ATTR = 'data-xfm-mf';
  const MF_DONE = new Set();
  let mfBurstCount = 0, mfBurstLimit = rand(20, 30);

  function findVerifiedTarget() {
    const articles = [...document.querySelectorAll('article[data-testid="tweet"]')];
    for (const a of articles.slice(1)) {
      if (a.hasAttribute(MF_ATTR) || isAd(a) || !hasVerifiedBadge(a)) continue;
      const link = a.querySelector('[data-testid="User-Name"] a[href^="/"]');
      if (!link) continue;
      const handle = link.getAttribute('href').replace(/^\//, '').toLowerCase();
      if (MF_DONE.has(handle)) { a.setAttribute(MF_ATTR, '1'); continue; }
      return { link, handle, article: a };
    }
    return null;
  }
  function clearMFMarks() { document.querySelectorAll(`[${MF_ATTR}]`).forEach(el => el.removeAttribute(MF_ATTR)); MF_DONE.clear(); mfBurstCount = 0; mfBurstLimit = rand(20, 30); }

  const UF_ATTR = 'data-xfm-uf';
  let ufScrolledToBottom = false, ufBurstCount = 0, ufBurstLimit = rand(20, 30);

  async function scrollToBottom() {
    log('📜 Cuộn xuống cuối...');
    let prev = 0, same = 0;
    while (same < 3) {
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(1500);
      const h = document.body.scrollHeight;
      if (h === prev) same++; else { same = 0; prev = h; }
    }
    log('✅ Đã xuống cuối');
  }

  function findUnfollowCandidate() {
    const cells = ufScrolledToBottom
      ? [...document.querySelectorAll('[data-testid="UserCell"]')].reverse()
      : document.querySelectorAll('[data-testid="UserCell"]');
    for (const cell of cells) {
      if (cell.hasAttribute(UF_ATTR)) continue;
      if (isAd(cell) || isWhitelisted(cell)) continue;
      const btn = cell.querySelector('[data-testid="unfollow"]') ||
                  [...cell.querySelectorAll('button')].find(b => {
                    const t = b.textContent.toLowerCase();
                    const a = (b.getAttribute('aria-label') || '').toLowerCase();
                    return t.includes('đang theo dõi') || t.includes('following') ||
                           a.includes('following') || a.includes('đang theo dõi');
                  });
      if (btn) return { btn, cell };
    }
    return null;
  }

  async function confirmUnfollow() {
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      const b =
        document.querySelector('[data-testid="confirmationSheetConfirm"]') ||
        document.querySelector('[data-testid="unfollow"]') ||
        [...document.querySelectorAll('[role="menuitem"]')].find(el => /unfollow|bỏ theo dõi/i.test(el.textContent)) ||
        [...document.querySelectorAll('button')].find(b => /^(unfollow|bỏ theo dõi)$/i.test(getBtnText(b)));
      if (b) { b.click(); return true; }
    }
    return false;
  }

  async function doUnfollow() {
    if (!running) return;
    if (getDailyCount() >= CFG.dailyLimit) { stopBot(); log(`🚫 Đạt giới hạn ${CFG.dailyLimit}/ngày`); return; }

    const topDown = mode === 'unfollow_topdown';
    if (!topDown && !ufScrolledToBottom) {
      await scrollToBottom();
      ufScrolledToBottom = true;
    }

    const result = findUnfollowCandidate();
    if (!result) {
      log(topDown ? 'Cuộn xuống tìm thêm...' : 'Cuộn lên tìm thêm...');
      window.scrollBy({ top: topDown ? rand(600, 900) : -rand(600, 900) });
      await sleep(800); scheduleNext(1_000); return;
    }

    const { btn, cell } = result;
    const handle = cellHandle(cell);
    cell.setAttribute(UF_ATTR, '1');
    if (!(await focusCell(cell)) || !btn.isConnected) { scheduleNext(500); return; }

    if (cellFollowsYou(cell) && hasVerifiedBadge(cell)) {
      log(`🛡️ Giữ @${handle} (tích xanh, follow bạn)`);
      scheduleNext(500); return;
    }

    btn.click();
    await sleep(400);

    const confirmed = await confirmUnfollow();
    if (!confirmed) { log('⚠️ Không confirm được, bỏ qua'); scheduleNext(3_000); return; }

    const daily = incrementDaily(); updateDailyDisplay();
    ufBurstCount++;
    log(`✓ Unfollow (${daily}/${CFG.dailyLimit}) — burst ${ufBurstCount}/${ufBurstLimit}`);
    if (daily >= CFG.dailyLimit) { stopBot(); log(`🚫 Đạt giới hạn ${CFG.dailyLimit}/ngày`); return; }

    if (ufBurstCount >= ufBurstLimit) {
      ufBurstCount = 0; ufBurstLimit = rand(20, 30);
      const rest = rand(CFG.restMin, CFG.restMax);
      log(`😴 Nghỉ ${Math.round(rest / 60_000)} phút...`);
      scheduleNext(rest);
    } else { scheduleNext(); }
  }

  async function doMassFollow() {
    if (!running) return;
    if (getDailyCount() >= CFG.dailyLimit) { stopBot(); log(`🚫 Đạt giới hạn ${CFG.dailyLimit}/ngày`); return; }
    if (!window.location.href.includes('/status/')) { log('⚠️ Mở bài đăng kêu gọi follow trước'); scheduleNext(5_000); return; }

    const result = findVerifiedTarget();
    if (!result) {
      log('Cuộn tìm verified...');
      window.scrollBy({ top: rand(600, 900) });
      await sleep(800); scheduleNext(1_000); return;
    }

    const { link, handle, article } = result;
    article.setAttribute(MF_ATTR, '1'); MF_DONE.add(handle);

    log(`🖱️ Rà @${handle}...`);
    link.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(rand(300, 600));
    triggerHover(link);

    let followBtn = null, alreadyFollowing = false;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      const card = document.querySelector('[data-testid="HoverCard"]');
      if (!card) continue;
      const btns = [...card.querySelectorAll('button')];
      followBtn = btns.find(isFollowBtn);
      if (followBtn) break;
      if (btns.some(isFollowingBtn)) { alreadyFollowing = true; break; }
    }

    if (alreadyFollowing) {
      log(`↩ Đã follow @${handle}`);
      await sleep(rand(1200, 2500)); // organic pause before the next person
      doAction(); return;
    }
    if (!followBtn) {
      log(`⚠️ Không thấy card @${handle}`);
      await sleep(rand(800, 1500));
      doAction(); return;
    }

    followBtn.click();
    await sleep(300);
    document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10 }));
    const daily = incrementDaily(); updateDailyDisplay();
    mfBurstCount++;
    log(`⚡ Followed @${handle} (${daily}/${CFG.dailyLimit}) — burst ${mfBurstCount}/${mfBurstLimit}`);
    if (daily >= CFG.dailyLimit) { stopBot(); log(`🚫 Đạt giới hạn ${CFG.dailyLimit}/ngày`); return; }

    if (mfBurstCount >= mfBurstLimit) {
      mfBurstCount = 0; mfBurstLimit = rand(20, 30);
      const rest = rand(CFG.restMin, CFG.restMax);
      log(`😴 Nghỉ ${Math.round(rest / 60_000)} phút...`);
      scheduleNext(rest);
    } else { scheduleNext(); }
  }

  const FB_ATTR = 'data-xfm-fb';
  function findFollowTarget() {
    for (const cell of document.querySelectorAll('[data-testid="UserCell"]')) {
      if (cell.hasAttribute(FB_ATTR) || isAd(cell)) continue;
      if ([...cell.querySelectorAll('button')].some(isFollowBtn)) return cell;
    }
    return null;
  }
  async function doAction() {
    if (!running) return;
    if (mode === 'massfollow') { doMassFollow(); return; }
    if (mode === 'unfollow' || mode === 'unfollow_topdown') { doUnfollow(); return; }
    if (getDailyCount() >= CFG.dailyLimit) { stopBot(); log(`🚫 Đạt giới hạn ${CFG.dailyLimit}/ngày`); return; }
    const cell = findFollowTarget();
    if (!cell) {
      log('Cuộn để load thêm...'); window.scrollBy({ top: rand(600, 900) });
      await sleep(800); scheduleNext(1_000); return;
    }
    const handle = cellHandle(cell);
    cell.setAttribute(FB_ATTR, '1');
    const btn = (await focusCell(cell)) && [...cell.querySelectorAll('button')].find(isFollowBtn);
    if (!btn) { scheduleNext(500); return; }
    btn.click();
    const daily = incrementDaily(); updateDailyDisplay();
    log(`✓ Follow @${handle} (${daily}/${CFG.dailyLimit})`);
    if (daily >= CFG.dailyLimit) { stopBot(); log(`🚫 Đạt giới hạn ${CFG.dailyLimit}/ngày`); return; }
    scheduleNext();
  }
  function scheduleNext(override) {
    if (!running) return;
    const delay = override ?? rand(CFG.minDelay, CFG.maxDelay);
    let rem = Math.ceil(delay / 1000);
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    updateTimer(rem);
    tickInterval = setInterval(() => { rem--; updateTimer(rem); if (rem <= 0) { clearInterval(tickInterval); tickInterval = null; } }, 1000);
    timer = setTimeout(() => { clearInterval(tickInterval); tickInterval = null; updateTimer(0); doAction(); }, delay);
  }

  function updateActionButtons() {
    document.getElementById('xfm-btn-follow')?.classList.toggle('xfm-f',  running && mode === 'follow');
    document.getElementById('xfm-btn-mass')?.classList.toggle('xfm-m',    running && mode === 'massfollow');
    document.getElementById('xfm-btn-unfollow')?.classList.toggle('xfm-u', running && mode === 'unfollow');
    document.getElementById('xfm-btn-topdown')?.classList.toggle('xfm-td', running && mode === 'unfollow_topdown');
  }
  function startBot(newMode) {
    if (running && mode === newMode) { stopBot(); return; }
    if (running) stopBot();
    mode = newMode; running = true;
    if (mode === 'unfollow' || mode === 'unfollow_topdown') {
      document.querySelectorAll(`[${UF_ATTR}]`).forEach(el => el.removeAttribute(UF_ATTR));
      ufScrolledToBottom = false; ufBurstCount = 0; ufBurstLimit = rand(20, 30);
    }
    updateActionButtons(); updatePageHint();
    const label = mode === 'massfollow' ? 'Mass Follow'
                : mode === 'follow' ? 'Follow Back'
                : mode === 'unfollow_topdown' ? 'Trên xuống dưới'
                : 'Dưới lên trên';
    log(`▶ ${label}...`);
    doAction();
  }
  function stopBot() {
    running = false; clearTimeout(timer);
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    updateTimer(0); updateActionButtons(); clearMFMarks();
    document.querySelectorAll(`[${FB_ATTR}]`).forEach(el => el.removeAttribute(FB_ATTR));
    document.querySelectorAll(`[${UF_ATTR}]`).forEach(el => el.removeAttribute(UF_ATTR));
    ufScrolledToBottom = false; ufBurstCount = 0; ufBurstLimit = rand(20, 30);
    log('⏹ Đã dừng');
  }

  let updatePageHint = () => {};

  function buildUI() {
    if (document.getElementById('xfm-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'xfm-panel';
    panel.innerHTML = `
      <div id="xfm-header"><span>Xmanager</span><button id="xfm-close">x</button></div>
      <div id="xfm-body">
        <div id="xfm-daily-row">Hôm nay: <span id="xfm-daily">0/400</span></div>
        <div class="xfm-row">
          <button id="xfm-btn-follow">Follow back</button>
          <button id="xfm-btn-mass">Mass follow</button>
        </div>
        <div class="xfm-row">
          <button id="xfm-btn-unfollow">Dưới lên trên</button>
          <button id="xfm-btn-wl">Whitelist</button>
        </div>
        <div class="xfm-row">
          <button id="xfm-btn-topdown">Trên xuống dưới</button>
          <button id="xfm-btn-delay">Setting delay</button>
        </div>
        <div id="xfm-status-row">Trạng thái: <span id="xfm-status">Sẵn sàng</span></div>
        <div id="xfm-timer-row"><span id="xfm-timer"></span></div>
      </div>
    `;

    const bubble = document.createElement('div');
    bubble.id = 'xfm-bubble';
    bubble.textContent = 'X';

    const wlPopup = document.createElement('div');
    wlPopup.id = 'xfm-wl-popup';
    wlPopup.className = 'xfm-popup';
    wlPopup.innerHTML = `
      <div class="xfm-popup-hd"><span>🛡️ Whitelist</span><button id="xfm-wl-close">×</button></div>
      <div class="xfm-popup-bd">
        <div id="xfm-wl-add-row"><input id="xfm-wl-input" type="text" placeholder="@handle" spellcheck="false"/><button id="xfm-wl-add">+</button></div>
        <div id="xfm-wl-list"></div>
      </div>
    `;

    const dlPopup = document.createElement('div');
    dlPopup.id = 'xfm-dl-popup';
    dlPopup.className = 'xfm-popup';
    dlPopup.innerHTML = `
      <div class="xfm-popup-hd"><span>⏱ Setting delay</span><button id="xfm-dl-close">×</button></div>
      <div class="xfm-popup-bd">
        <div class="xfm-dl-label">Giữa mỗi lượt (giây)</div>
        <div class="xfm-dl-row"><input id="xfm-dl-min" type="number" min="1"/><span>–</span><input id="xfm-dl-max" type="number" min="1"/></div>
        <div class="xfm-dl-label">Nghỉ sau mỗi đợt 20–30 lượt (phút)</div>
        <div class="xfm-dl-row"><input id="xfm-rest-min" type="number" min="1"/><span>–</span><input id="xfm-rest-max" type="number" min="1"/></div>
        <button id="xfm-dl-save">Lưu</button>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #xfm-panel {
        position:fixed;bottom:24px;right:24px;z-index:99999;width:190px;
        background:#0c0c14;border:1px solid rgba(255,255,255,0.07);border-radius:12px;
        font-family:-apple-system,'Segoe UI',system-ui,sans-serif;font-size:11px;color:#f1f5f9;
        box-shadow:0 12px 40px rgba(0,0,0,0.75);overflow:hidden;
      }
      #xfm-header {
        display:flex;align-items:center;justify-content:space-between;
        padding:7px 10px;
        background:linear-gradient(118deg,#1363c9,#1d9bf0 55%,#3db8ff);
        cursor:move;user-select:none;font-weight:600;font-size:10px;color:#fff;letter-spacing:0.3px;
      }
      #xfm-close {
        background:rgba(255,255,255,0.18);border:none;color:#fff;font-size:12px;
        cursor:pointer;padding:1px 6px;border-radius:5px;line-height:1.4;
      }
      #xfm-close:hover { background:#ef4444; }
      #xfm-bubble {
        display:none;position:fixed;bottom:24px;right:24px;z-index:99999;
        width:40px;height:40px;border-radius:50%;
        background:linear-gradient(135deg,#1d9bf0,#1363c9);
        color:#fff;font-size:14px;font-weight:700;
        align-items:center;justify-content:center;
        cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.5);user-select:none;
      }
      #xfm-bubble.show { display:flex; }
      #xfm-body { padding:8px 10px;display:flex;flex-direction:column;gap:6px; }
      #xfm-daily-row { font-size:10px;color:#64748b; }
      #xfm-daily { color:#3db8ff;font-size:11px;font-weight:700; }
      .xfm-row { display:flex;gap:5px; }
      .xfm-row button {
        flex:1;padding:6px 0;border:none;border-radius:7px;font-size:10px;font-weight:600;
        cursor:pointer;transition:all 0.15s;background:rgba(255,255,255,0.07);color:#64748b;
        text-align:center;
      }
      .xfm-row button:hover { background:rgba(255,255,255,0.12);color:#94a3b8; }
      #xfm-btn-follow.xfm-f   { background:linear-gradient(135deg,#1d9bf0,#1363c9);color:#fff;box-shadow:0 2px 8px rgba(29,155,240,0.4); }
      #xfm-btn-mass.xfm-m     { background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;box-shadow:0 2px 8px rgba(245,158,11,0.4); }
      #xfm-btn-unfollow.xfm-u { background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;box-shadow:0 2px 8px rgba(239,68,68,0.4); }
      #xfm-btn-topdown.xfm-td { background:linear-gradient(135deg,#14b8a6,#0d9488);color:#fff;box-shadow:0 2px 8px rgba(20,184,166,0.4); }
      #xfm-status-row { font-size:10px;color:#475569; }
      #xfm-status { color:#64748b; }
      #xfm-timer-row { font-size:10px;color:#334155;text-align:center;min-height:12px; }
      .xfm-popup {
        display:none;position:fixed;bottom:76px;right:24px;z-index:100000;width:260px;
        background:#0f0f1a;border:1px solid rgba(255,255,255,0.1);border-radius:14px;
        box-shadow:0 20px 60px rgba(0,0,0,0.8);font-size:12px;color:#f1f5f9;overflow:hidden;
      }
      .xfm-popup-hd {
        display:flex;align-items:center;justify-content:space-between;padding:10px 14px;
        background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.06);font-weight:700;
      }
      .xfm-popup-hd button { background:none;border:none;color:#64748b;cursor:pointer;font-size:17px;padding:0 2px; }
      .xfm-popup-hd button:hover { color:#ef4444; }
      .xfm-popup-bd { padding:10px 14px;display:flex;flex-direction:column;gap:8px; }
      #xfm-wl-add-row { display:flex;gap:6px; }
      #xfm-wl-input { flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:7px;color:#f1f5f9;font-size:11px;padding:5px 8px;outline:none; }
      #xfm-wl-input:focus { border-color:rgba(29,155,240,0.4); }
      #xfm-wl-add { background:linear-gradient(135deg,#1d9bf0,#1363c9);color:#fff;border:none;border-radius:7px;padding:5px 10px;font-size:14px;font-weight:700;cursor:pointer; }
      #xfm-wl-list { display:flex;flex-wrap:wrap;gap:4px;max-height:150px;overflow-y:auto; }
      .xfm-wl-tag { display:flex;align-items:center;gap:3px;background:rgba(29,155,240,0.1);border:1px solid rgba(29,155,240,0.22);border-radius:20px;padding:2px 8px;font-size:10px;color:#1d9bf0; }
      .xfm-wl-tag button { background:none;border:none;color:#334155;cursor:pointer;font-size:11px;padding:0; }
      .xfm-wl-tag button:hover { color:#ef4444; }
      .xfm-dl-label { font-size:10px;color:#94a3b8; }
      .xfm-dl-row { display:flex;align-items:center;gap:6px;color:#64748b; }
      .xfm-dl-row input { flex:1;min-width:0;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:7px;color:#f1f5f9;font-size:11px;padding:5px 8px;outline:none; }
      .xfm-dl-row input:focus { border-color:rgba(29,155,240,0.4); }
      #xfm-dl-save { background:linear-gradient(135deg,#1d9bf0,#1363c9);color:#fff;border:none;border-radius:7px;padding:6px 0;font-size:11px;font-weight:700;cursor:pointer; }
    `;

    document.head.appendChild(style);
    document.body.appendChild(panel);
    document.body.appendChild(bubble);
    document.body.appendChild(wlPopup);
    document.body.appendChild(dlPopup);
    updateDailyDisplay();
    updateActionButtons();

    document.getElementById('xfm-btn-follow').addEventListener('click',   () => startBot('follow'));
    document.getElementById('xfm-btn-mass').addEventListener('click',     () => startBot('massfollow'));
    document.getElementById('xfm-btn-unfollow').addEventListener('click', () => startBot('unfollow'));
    document.getElementById('xfm-btn-topdown').addEventListener('click',  () => startBot('unfollow_topdown'));

    document.getElementById('xfm-close').addEventListener('click', () => {
      panel.style.display = 'none';
      bubble.classList.add('show');
    });
    bubble.addEventListener('click', () => {
      bubble.classList.remove('show');
      panel.style.display = '';
    });

    function renderWLList() {
      const container = document.getElementById('xfm-wl-list'); if (!container) return;
      container.innerHTML = getWL().map(h => `<div class="xfm-wl-tag">@${h}<button data-h="${h}">×</button></div>`).join('');
      container.querySelectorAll('.xfm-wl-tag button').forEach(btn => btn.addEventListener('click', () => { removeFromWL(btn.dataset.h); renderWLList(); }));
    }
    function addWLHandle() {
      const input = document.getElementById('xfm-wl-input');
      if (addToWL(input.value)) { input.value = ''; renderWLList(); }
      else { input.style.borderColor = '#ef4444'; setTimeout(() => { input.style.borderColor = ''; }, 800); }
    }
    document.getElementById('xfm-btn-wl').addEventListener('click', () => { renderWLList(); dlPopup.style.display = 'none'; wlPopup.style.display = 'block'; });
    document.getElementById('xfm-wl-close').addEventListener('click', () => { wlPopup.style.display = 'none'; });
    document.getElementById('xfm-wl-add').addEventListener('click', addWLHandle);
    document.getElementById('xfm-wl-input').addEventListener('keydown', e => { if (e.key === 'Enter') addWLHandle(); });

    const dlFields = [['xfm-dl-min', 'minDelay', 1_000], ['xfm-dl-max', 'maxDelay', 1_000], ['xfm-rest-min', 'restMin', 60_000], ['xfm-rest-max', 'restMax', 60_000]];
    document.getElementById('xfm-btn-delay').addEventListener('click', () => {
      dlFields.forEach(([id, k, u]) => { const el = document.getElementById(id); el.value = CFG[k] / u; el.style.borderColor = ''; });
      wlPopup.style.display = 'none'; dlPopup.style.display = 'block';
    });
    document.getElementById('xfm-dl-close').addEventListener('click', () => { dlPopup.style.display = 'none'; });
    document.getElementById('xfm-dl-save').addEventListener('click', () => {
      const v = dlFields.map(([id, k, u]) => [id, k, Math.round(parseFloat(document.getElementById(id).value) * u)]);
      const bad = v.filter(([, , ms]) => !(ms > 0)).map(([id]) => id);
      if (v[0][2] > v[1][2]) bad.push(v[0][0], v[1][0]);
      if (v[2][2] > v[3][2]) bad.push(v[2][0], v[3][0]);
      if (bad.length) { bad.forEach(id => { const el = document.getElementById(id); el.style.borderColor = '#ef4444'; setTimeout(() => { el.style.borderColor = ''; }, 800); }); return; }
      const saved = Object.fromEntries(v.map(([, k, ms]) => [k, ms]));
      Object.assign(CFG, saved);
      localStorage.setItem(DELAY_KEY, JSON.stringify(saved));
      dlPopup.style.display = 'none';
      log(`⏱ Delay ${CFG.minDelay / 1000}–${CFG.maxDelay / 1000}s, nghỉ ${CFG.restMin / 60_000}–${CFG.restMax / 60_000}p`);
    });

    let ox = 0, oy = 0, mx = 0, my = 0;
    document.getElementById('xfm-header').addEventListener('mousedown', e => {
      e.preventDefault(); mx = e.clientX; my = e.clientY;
      const drag = e => { ox = mx - e.clientX; oy = my - e.clientY; mx = e.clientX; my = e.clientY; panel.style.top = (panel.offsetTop - oy) + 'px'; panel.style.left = (panel.offsetLeft - ox) + 'px'; panel.style.bottom = 'auto'; panel.style.right = 'auto'; };
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', () => document.removeEventListener('mousemove', drag), { once: true });
    });
  }

  const obs = new MutationObserver(() => { if (document.body && !document.getElementById('xfm-panel')) { buildUI(); updateDailyDisplay(); updateActionButtons(); } });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => { if (document.body && !document.getElementById('xfm-panel')) buildUI(); }, 2000);
  if (document.body) buildUI();
})();
