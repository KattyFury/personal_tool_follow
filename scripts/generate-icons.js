import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const directory = new URL('../extension/icons/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  for (const size of [16, 32, 48, 128]) {
    const data = await page.evaluate(size => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      context.font = `${size * 0.85}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('👥', size / 2, size * 0.53);
      return canvas.toDataURL('image/png').split(',')[1];
    }, size);
    await writeFile(new URL(`people-${size}.png`, directory), Buffer.from(data, 'base64'));
  }
} finally { await browser.close(); }
console.log('Generated people emoji icons at 16, 32, 48, and 128 pixels.');
