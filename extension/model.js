export const defaults = {
  x: { dailyLimit: 400, minDelay: 60, maxDelay: 90, mode: 'follow', personal: true, whitelist: "arc, tempo, ritualnet, seismicsys, base, megaeth, metamask, kastxyz, degentokenbase, 01exchange, decibeltrade, linera_io, somnia_network, relayprotocol, jumperapp, prismaxai, axisrobotics, psdnai, nansen_ai, ethos_network, wallchain, forteprotocol, upshot_cards, megapot, spektergames, pixiechess, integra_layer, getoro_xyz, farcaster_xyz, bluesky, stormrae_ai, concretexyz, ezwalletapp, kucoincom, bybit_official, binanceangels, riverdotinc, river4fun, binance, bitget, arcium, bybitafrica, binancevip" },
  binance: { dailyLimit: 500, minDelay: 10, maxDelay: 30 }
};
export const dayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function validSettings(platform, value) {
  if (!defaults[platform] || !value) throw Error('Unknown platform');
  const result = { ...defaults[platform], ...value };
  for (const key of ['dailyLimit', 'minDelay', 'maxDelay']) if (!Number.isFinite(result[key]) || result[key] < 1) throw Error('Enter positive numbers.');
  if (!Number.isInteger(result.dailyLimit) || result.dailyLimit > 10000) throw Error('Daily cap must be a whole number from 1 to 10,000.');
  if (result.minDelay > result.maxDelay || result.maxDelay > 86400) throw Error('Delay range is invalid.');
  if (platform === 'x') {
    if (!['follow', 'massfollow', 'unfollow', 'unfollow_topdown'].includes(result.mode)) throw Error('Choose an X mode.');
    delete result.restMin; delete result.restMax;
    result.personal = !!result.personal;
    result.whitelist = [...new Set(String(result.whitelist).split(/[\s,]+/).map(s => s.replace(/^@/, '').toLowerCase()).filter(s => /^[a-z0-9_]{1,15}$/.test(s)))].join(', ');
  }
  return result;
}
export function reserveCount(record, limit, date = new Date()) {
  const day = dayKey(date);
  const next = record?.day === day ? { ...record } : { day, attempts: 0, confirmed: 0 };
  if (next.attempts >= limit) throw Error('Daily cap reached.');
  next.attempts++;
  return next;
}
export function platformFor(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    if (['x.com', 'twitter.com'].includes(u.hostname)) return 'x';
    if (u.hostname === 'www.binance.com' && /^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?square(?:\/|$)/.test(u.pathname)) return 'binance';
  } catch {}
  return null;
}
