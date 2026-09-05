const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });
  page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message));

  await page.goto('http://localhost:5176/', { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/\S/).first().waitFor({ timeout: 8000 }).catch(() => {});
  // fill login form - find inputs by type
  const inputs = await page.locator('input[type="email"], input[name="email"], input[type="text"]').all();
  if (inputs.length) { await inputs[0].fill('provider.demo@rafidain.iq'); }
  const pws = await page.locator('input[type="password"]').first();
  await pws.fill('Provider@123');
  await page.locator('button[type="submit"], button.btn-primary').first().click();
  await page.waitForTimeout(2000);

  const routes = [
    ['Promotions', '/promotions'],
    ['Coupons', '/coupons'],
    ['Orders', '/orders'],
    ['Wallet', '/wallet'],
    ['Ratings', '/ratings'],
    ['Profile', '/profile'],
    ['Bookings', '/bookings'],
    ['Dashboard', '/'],
  ];
  for (const [name, path] of routes) {
    errors.length = 0;
    await page.goto('http://localhost:5176' + path, { waitUntil: 'networkidle' }).catch(e => errors.push('[goto] ' + e.message));
    await page.waitForTimeout(1200);
    const bodyText = (await page.textContent('body').catch(() => '')).trim().slice(0, 60);
    console.log(`=== ${name} ${path} | body: ${bodyText || '(empty)'} | errors: ${errors.length}`);
    for (const e of errors.slice(0, 4)) console.log('   ' + e);
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });