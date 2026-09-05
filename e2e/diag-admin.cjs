const { chromium } = require('playwright');

const routes = ['/', '/executive', '/governorates', '/districts', '/agents', '/services', '/catalog', '/coupons', '/reviews', '/notifications', '/home-layout', '/providers', '/orders', '/customers', '/commissions', '/promotions', '/wallets', '/agent-withdrawals', '/disputes', '/payment-gateways', '/leases', '/activity', '/financial-report', '/settings', '/roles', '/admin-users', '/bulk', '/content', '/profile'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[console] ' + msg.text().slice(0, 300)); });
  page.on('pageerror', (err) => errors.push('[pageerror] ' + String(err).slice(0, 300)));

  await page.goto('http://localhost:5175/', { waitUntil: 'networkidle' }).catch((e) => console.log('login goto err', e.message));
  await page.waitForTimeout(1500);
  const inputs = await page.locator('input[type="email"], input[name="email"], input[type="text"]').all();
  if (inputs.length) await inputs[0].fill('admin@rafidain.iq');
  const pws = page.locator('input[type="password"]').first();
  await pws.fill('Admin@123');
  await page.locator('button[type="submit"], button.btn-primary').first().click();
  await page.waitForTimeout(2500);

  for (const path of routes) {
    errors.length = 0;
    await page.goto('http://localhost:5175' + path, { waitUntil: 'networkidle' }).catch((e) => errors.push('[goto] ' + e.message));
    await page.waitForTimeout(1200);
    const body = (await page.textContent('body').catch(() => '')).trim().slice(0, 60);
    const notWhite = await page.locator('main, .content, .page, .card').first().isVisible().catch(() => false);
    console.log(`=== ${path} | body: ${body || '(empty)'} | contentVisible=${notWhite} | errors: ${errors.length}`);
    for (const e of errors.slice(0, 3)) console.log('   ' + e);
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });