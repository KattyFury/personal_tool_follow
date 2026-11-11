import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<style>#name { width:200px;height:50px;margin:100px } #card { display:none } #name:hover #card { display:block }</style><div id="name">Example user<div id="card">Profile card</div></div>');
  await page.evaluate(() => {
    window.pointerEvents = [];
    document.querySelector('#name').addEventListener('mouseover', event => pointerEvents.push(event.isTrusted));
    document.querySelector('#name').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  });
  assert.equal(await page.locator('#card').isVisible(), false);
  const session = await page.context().newCDPSession(page);
  const rect = await page.locator('#name').boundingBox();
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + rect.width / 2, y: rect.y + 10, button: 'none', buttons: 0 });
  assert.equal(await page.locator('#card').isVisible(), true);
  assert.deepEqual(await page.evaluate(() => pointerEvents), [false, true]);
  console.log('Verified locally: dispatched JS event does not activate CSS hover; browser input activates hover and produces a trusted mouse event. No live site or user profile was used.');
} finally { await browser.close(); }
