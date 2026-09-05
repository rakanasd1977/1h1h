const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });
  page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message));

  // ===== وكيل (5174) =====
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
  const em = await page.locator('input[type="email"], input[name="email"], input[type="text"]').first();
  await em.fill('agent.baghdad@rafidain.iq').catch(() => {});
  await page.locator('input[type="password"]').first().fill('Agent@123');
  await page.locator('button[type="submit"], button.btn-primary').first().click();
  await page.waitForTimeout(2000);

  const agentRoutes = [
    ['Dashboard', '/'],
    ['Providers', '/providers'],
    ['ProviderDetail', '/providers/1'],
    ['Orders', '/orders'],
    ['Customers', '/customers'],
    ['Commissions', '/commissions'],
    ['Wallet', '/wallet'],
    ['Lease', '/lease'],
    ['Profile', '/profile'],
    ['Activity', '/activity'],
  ];
  for (const [name, path] of agentRoutes) {
    errors.length = 0;
    await page.goto('http://localhost:5174' + path, { waitUntil: 'networkidle' }).catch(e => errors.push('[goto] ' + e.message));
    await page.waitForTimeout(1200);
    const bodyText = (await page.textContent('body').catch(() => '')).trim().slice(0, 60);
    console.log(`[AGENT] === ${name} ${path} | body: ${bodyText || '(empty)'} | errors: ${errors.length}`);
    for (const e of errors.slice(0, 4)) console.log('   ' + e);
  }

  // ===== زبون (5173) =====
  await page.goto('http://localhost:5173/#/', { waitUntil: 'networkidle' }).catch(() => {});
  await page.locator('.gov-gate .gov-item').filter({ hasText: 'بغداد' }).first().click().catch(() => {});
  await page.waitForTimeout(1500);

  const customerRoutes = [
    ['Home', '/#/'],
    ['Search', '/#/search'],
    ['Cart', '/#/cart'],
    ['Orders', '/#/orders'],
    ['Profile', '/#/profile'],
    ['Favorites', '/#/favorites'],
    ['Addresses', '/#/addresses'],
    ['Coupons', '/#/coupons'],
    ['Loyalty', '/#/loyalty'],
    ['Referral', '/#/referral'],
    ['Disputes', '/#/disputes'],
    ['Notifications', '/#/notifications'],
    ['Faq', '/#/faq'],
    ['Privacy', '/#/privacy'],
  ];
  for (const [name, path] of customerRoutes) {
    errors.length = 0;
    await page.goto('http://localhost:5173' + path, { waitUntil: 'networkidle' }).catch(e => errors.push('[goto] ' + e.message));
    await page.waitForTimeout(1000);
    const bodyText = (await page.textContent('body').catch(() => '')).trim().slice(0, 60);
    console.log(`[CUSTOMER] === ${name} ${path} | body: ${bodyText || '(empty)'} | errors: ${errors.length}`);
    for (const e of errors.slice(0, 4)) console.log('   ' + e);
  }

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });