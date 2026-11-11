import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { defaults } from '../extension/model.js';

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:4173/**', async route => {
    const name = new URL(route.request().url()).pathname.slice(1) || 'sidepanel.html';
    const file = path.resolve('extension', name);
    if (!file.startsWith(path.resolve('extension') + path.sep)) return route.abort();
    const type = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html';
    await route.fulfill({ body: await readFile(file), contentType: type });
  });
  await page.addInitScript(defaults => {
    const state = { ok: true, settings: defaults, counts: {}, day: '2026-11-11', runs: {}, tabs: [{ id: 1, platform: 'x', title: 'Your followers / X' }, { id: 2, platform: 'binance', title: 'Binance Square' }] };
    window.chrome = { runtime: { async sendMessage(msg) {
      if (msg.type === 'save') state.settings[msg.platform] = msg.settings;
      if (msg.type === 'start') state.runs[msg.platform] = { running: true, status: 'Looking for an eligible account…', settings: state.settings[msg.platform], tabId: msg.tabId };
      if (msg.type === 'stop') Object.assign(state.runs[msg.platform], { running: false, status: 'Stopped' });
      return structuredClone(state);
    } } };
  }, defaults);
  await page.goto('http://127.0.0.1:4173/sidepanel.html');
  await expect(page.locator('#dailyLimit')).toHaveValue('400');
});

test('vertical layout supports settings and start/stop', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const layout = await page.evaluate(() => {
    const left = document.querySelector('.platforms').getBoundingClientRect(), right = document.querySelector('.settings').getBoundingClientRect();
    return { ratio: left.height / right.height, height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth };
  });
  expect(layout.ratio).toBeGreaterThan(1.95); expect(layout.ratio).toBeLessThan(2.05);
  expect(layout.height).toBeLessThanOrEqual(900); expect(layout.width).toBe(1280);
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Binance', exact: true }).click();
  await expect(page.locator('#dailyLimit')).toHaveValue('500');
  await expect(page.locator('#minDelay')).toHaveValue('10'); await expect(page.locator('#maxDelay')).toHaveValue('30');
  await page.locator('#dailyLimit').fill('450'); await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('#binance-count')).toHaveText('0 / 450');
  await page.locator('#binance-start').click(); await expect(page.locator('#binance-state')).toHaveText('Running');
  await page.locator('#binance-stop').click(); await expect(page.locator('#binance-state')).toHaveText('Stopped');
  await page.getByRole('button', { name: 'X', exact: true }).click();
  await expect(page.locator('#dailyLimit')).toHaveValue('400');
  await expect(page.locator('#personal')).toBeChecked();
  await expect(page.locator('#restMin, #restMax')).toHaveCount(0);
  expect((await page.locator('#whitelist').boundingBox()).height).toBeGreaterThanOrEqual(48);
  await page.locator('#whitelist').fill('alice, bob');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Binance', exact: true }).click();
  await expect(page.locator('#whitelist')).toBeHidden();
  await page.getByRole('button', { name: 'X', exact: true }).click();
  await expect(page.locator('#whitelist')).toHaveValue('alice, bob');
  expect(errors).toEqual([]);
});

for (const width of [390, 360, 320]) test(`no horizontal overflow at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  const sizes = await page.locator('h1,h2,p,button,label,input,select,textarea,footer').evaluateAll(elements => elements.map(el => parseFloat(getComputedStyle(el).fontSize)));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  if (width === 390) await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
});

test('sidebar keeps controls and settings together at 400 by 800', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  const layout = await page.evaluate(() => {
    const left = document.querySelector('.platforms').getBoundingClientRect(), right = document.querySelector('.settings').getBoundingClientRect();
    return { ratio: left.height / right.height, height: document.documentElement.scrollHeight, settingsBottom: right.bottom, functionsTop: left.y };
  });
  expect(layout.ratio).toBeCloseTo(2, 1);
  expect(layout.functionsTop).toBeGreaterThan(layout.settingsBottom);
  expect(layout.height).toBeLessThanOrEqual(800);
  await page.screenshot({ path: 'test-results/sidebar.png', fullPage: true });
});

test('fits one sidebar screen at 400 by 740', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(740);
  const layout = await page.evaluate(() => {
    const settings = document.querySelector('.settings');
    return { settingsFits: settings.scrollHeight <= settings.clientHeight, buttonsFit: [...document.querySelectorAll('.platforms .actions')].every(el => el.getBoundingClientRect().bottom <= el.closest('article').getBoundingClientRect().bottom) };
  });
  expect(layout.settingsFits).toBe(true); expect(layout.buttonsFit).toBe(true);
  await page.screenshot({ path: 'test-results/sidebar-compact.png', fullPage: true });
});
