import { chromium } from '@playwright/test';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

function findFullChrome() {
  const base = join(process.env.LOCALAPPDATA, 'ms-playwright');
  if (!existsSync(base)) return null;
  for (const d of readdirSync(base)) {
    if (d.startsWith('chromium') && !d.includes('headless')) {
      for (const sub of ['chrome-win64', 'chrome-win']) {
        const p = join(base, d, sub, 'chrome.exe');
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (e) {
    const exe = findFullChrome();
    if (exe) return await chromium.launch({ executablePath: exe });
    throw e;
  }
}

const BASE = process.env.ADMIN_URL || 'http://localhost:5175';
const API = process.env.API_URL || 'http://localhost:4001';
const NEW_NAME = 'تطبيق رفيدين التجريبي ' + Date.now();

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const email = page.locator('input[type="email"]').first();
  const pass = page.locator('input[type="password"]').first();
  if ((await email.count()) > 0 && (await pass.count()) > 0) {
    await email.fill('admin@rafidain.iq');
    await pass.fill('Admin@123');
    const loginBtn = page.getByRole('button', { name: /دخول|تسجيل/ }).first();
    await loginBtn.click({ timeout: 10000 });
    await page.waitForTimeout(1500);
  }

  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const field = page.locator('.field', { hasText: 'اسم التطبيق' });
  const input = field.locator('input').first();
  await input.fill('');
  await input.fill(NEW_NAME);
  await page.waitForTimeout(300);
  await field.locator('button', { hasText: 'حفظ' }).first().click();

  let toast = false;
  try {
    await page.waitForFunction(() => document.body.innerText.includes('تم حفظ'), { timeout: 8000 });
    toast = true;
  } catch {}

  await page.waitForTimeout(800);
  const api = await page.evaluate(async (apiUrl) => {
    const r = await fetch(apiUrl + '/api/settings/app_name', { credentials: 'include' });
    return r.json();
  }, API);

  const persisted = !!(api && api.data && api.data.app_name && api.data.app_name.value === NEW_NAME);
  console.log('TOAST_SHOWN:', toast);
  console.log('API app_name:', JSON.stringify(api));
  console.log('PERSISTED:', persisted);
  console.log('PAGE_ERRORS:', errors.join(' | ') || 'none');
  await browser.close();
  process.exit(persisted ? 0 : 1);
})();
