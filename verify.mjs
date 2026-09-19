const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  
  const errors = [];
  const failedRequests = [];
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('requestfailed', (req) => {
    failedRequests.push(req.url() + ' - ' + req.failure().errorText);
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      failedRequests.push(resp.status() + ' ' + resp.url());
    }
  });

  console.log('=== Loading site with cache buster ===');
  const ts = Date.now();
  await page.goto(`https://murekefumusichub.fredrickmakori102.workers.dev/?t=${ts}`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
  await page.waitForTimeout(3000);

  console.log('=== Page title ===');
  const title = await page.title();
  console.log('Title:', title);

  console.log('=== Checking bundle reference ===');
  const html = await page.content();
  const bundleMatch = html.match(/index-[A-Za-z0-9_]+\.js/);
  console.log('Bundle in HTML:', bundleMatch ? bundleMatch[0] : 'NOT FOUND');

  console.log('=== Current URL ===');
  console.log('URL:', page.url());

  console.log('=== Console errors ===');
  errors.forEach(e => console.log('ERROR:', e));

  console.log('=== Failed requests (>=400) ===');
  failedRequests.forEach(r => console.log('FAILED:', r));

  await page.screenshot({ path: 'C:/Users/USER/Desktop/murekefu-home.png', fullPage: false });
  console.log('Screenshot saved to Desktop');

  // Try to navigate to login
  console.log('=== Looking for login button ===');
  const loginBtn = await page.locator('text=/sign in|log in/i').first();
  if (loginBtn) {
    console.log('Found login button, clicking...');
    await loginBtn.click();
    await page.waitForTimeout(2000);
    const loginUrl = page.url();
    console.log('After click URL:', loginUrl);
    await page.screenshot({ path: 'C:/Users/USER/Desktop/murekefu-login.png', fullPage: false });
  } else {
    console.log('No login button found - checking page text...');
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    console.log('Page text:', bodyText);
  }

  await browser.close();
})();
