const { test, expect } = require('@playwright/test');

// Never send test orders or personal data to the live order service.
test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
    return route.abort();
  });
});

async function openMenu(page) {
  await page.goto('/menu.html');
  await expect(page.locator('#submitOrder')).toBeEnabled();
  return page.evaluate(() => window.SNACKIFY_CONFIG.ordersApiUrl);
}

async function fillOrder(page) {
  await page.locator('#name').fill('  Test Customer  ');
  await page.locator('#phone').fill('+1 (202) 555-0100');
  await page.getByRole('button', { name: 'Increase Donut quantity', exact: true }).click();
}

for (const width of [320, 375, 1280]) {
  test(`both pages have local styling, intact images and no overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) => errors.push(request.url()));
    for (const path of ['/', '/menu.html']) {
      await page.goto(path);
      await expect(page.locator('nav')).toHaveCSS('display', 'flex');
      await expect(page.locator('h1')).toHaveCSS('font-weight', /700|900/);
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        imagesLoaded: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
        compiledCss: [...document.styleSheets].some((sheet) => sheet.href?.endsWith('/styles.css') && sheet.cssRules.length > 0)
      }));
      expect(state).toEqual({ overflow: false, imagesLoaded: true, compiledCss: true });
    }
    expect(errors).toEqual([]);
  });
}

test('cart calculates totals and enforces quantity boundaries', async ({ page }) => {
  await openMenu(page);
  const minus = page.getByRole('button', { name: 'Decrease Donut quantity', exact: true });
  const plus = page.getByRole('button', { name: 'Increase Donut quantity', exact: true });
  await expect(minus).toBeDisabled();
  for (const item of ['Donut', 'Chai', 'Coffee', 'Pasta']) {
    await page.getByRole('button', { name: `Increase ${item} quantity`, exact: true }).click();
  }
  await expect(page.locator('#totalPrice')).toHaveText('230.00');
  await minus.click();
  await expect(page.locator('#totalPrice')).toHaveText('180.00');
  await expect(minus).toBeDisabled();
  await plus.evaluate((button) => { for (let i = 0; i < 105; i += 1) button.click(); });
  await expect(page.locator('#donutCount .quantity-value')).toHaveText('99');
  await expect(plus).toBeDisabled();
  await expect(page.locator('#totalPrice')).toHaveText('5130.00');
});

test('invalid details and an empty cart cannot submit an order', async ({ page }) => {
  const endpoint = await openMenu(page);
  let requests = 0;
  await page.route(endpoint, (route) => { requests += 1; return route.abort(); });
  await page.locator('#submitOrder').click();
  await expect(page.locator('#orderStatus')).toHaveAttribute('data-state', 'error');
  await page.locator('#name').fill('   ');
  await page.locator('#phone').fill('123');
  await page.locator('#submitOrder').click();
  await expect(page.locator('#name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#phone')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#name').fill('Test Customer');
  await page.locator('#phone').fill('+1 (202) 555-0100');
  await page.locator('#submitOrder').click();
  await expect(page.locator('#orderStatus')).toContainText('at least one item');
  expect(requests).toBe(0);
});

test('successful checkout preserves the API contract, prevents duplicates and resets every field', async ({ page }) => {
  const endpoint = await openMenu(page);
  const requests = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route(endpoint, async (route) => {
    requests.push(route.request().postDataJSON());
    await gate;
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{"id":"test-order"}' });
  });
  await fillOrder(page);
  await page.locator('#isParcel').check();
  await page.locator('#paymentCash').check();
  await page.locator('#submitOrder').click();
  await expect(page.locator('#orderForm')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#submitOrder')).toBeDisabled();
  await expect(page.locator('#name')).toBeDisabled();
  await page.locator('#orderForm').dispatchEvent('submit');
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toEqual({
    customerName: 'Test Customer', phone: '+1 (202) 555-0100', isParcel: true,
    paymentMethod: 'Cash', items: [{ id: 'donut', name: 'Donut', quantity: 1, price: 50 }], totalPrice: 50
  });
  release();
  await expect(page.locator('#orderStatus')).toHaveAttribute('data-state', 'success');
  await expect(page.locator('#name')).toHaveValue('');
  await expect(page.locator('#phone')).toHaveValue('');
  await expect(page.locator('#isParcel')).not.toBeChecked();
  await expect(page.locator('#paymentUpi')).toBeChecked();
  await expect(page.locator('#totalPrice')).toHaveText('0.00');
  await expect(page.locator('#submitOrder')).toBeEnabled();
  expect(requests).toHaveLength(1);
});

test('an empty successful response does not show a false network failure', async ({ page }) => {
  const endpoint = await openMenu(page);
  await page.route(endpoint, (route) => route.fulfill({ status: 204 }));
  await fillOrder(page);
  await page.locator('#submitOrder').click();
  await expect(page.locator('#orderStatus')).toHaveAttribute('data-state', 'success');
  await expect(page.locator('#totalPrice')).toHaveText('0.00');
});

for (const status of [400, 503]) {
  test(`HTTP ${status} keeps the cart and personal fields for review`, async ({ page }) => {
    const endpoint = await openMenu(page);
    await page.route(endpoint, (route) => route.fulfill({
      status, contentType: 'text/html', body: '<h1>Untrusted server details</h1>'
    }));
    await fillOrder(page);
    await page.locator('#paymentCard').check();
    await page.locator('#isParcel').check();
    await page.locator('#submitOrder').click();
    await expect(page.locator('#orderStatus')).toContainText(`HTTP ${status}`);
    await expect(page.locator('#orderStatus')).not.toContainText('Untrusted server details');
    await expect(page.locator('#name')).toHaveValue('  Test Customer  ');
    await expect(page.locator('#phone')).toHaveValue('+1 (202) 555-0100');
    await expect(page.locator('#paymentCard')).toBeChecked();
    await expect(page.locator('#isParcel')).toBeChecked();
    await expect(page.locator('#totalPrice')).toHaveText('50.00');
    await expect(page.locator('#submitOrder')).toBeEnabled();
    if (status >= 500) await expect(page.locator('#uncertainWarning')).toBeVisible();
  });
}

test('a network failure warns about an uncertain order without discarding it', async ({ page }) => {
  const endpoint = await openMenu(page);
  await page.route(endpoint, (route) => route.abort('failed'));
  await fillOrder(page);
  await page.locator('#submitOrder').click();
  await expect(page.locator('#orderStatus')).toContainText('could not confirm');
  await expect(page.locator('#uncertainWarning')).toBeVisible();
  await expect(page.locator('#totalPrice')).toHaveText('50.00');
  await expect(page.locator('#submitOrder')).toBeEnabled();
});

test('a stalled order times out and restores the controls without automatic retry', async ({ page }) => {
  await page.clock.install();
  const endpoint = await openMenu(page);
  let requests = 0;
  await page.route(endpoint, () => { requests += 1; });
  await fillOrder(page);
  await page.locator('#submitOrder').click();
  await expect.poll(() => requests).toBe(1);
  await page.clock.fastForward(31000);
  await expect(page.locator('#orderStatus')).toContainText('timed out after 30 seconds');
  await expect(page.locator('#uncertainWarning')).toBeVisible();
  await expect(page.locator('#totalPrice')).toHaveText('50.00');
  await expect(page.locator('#submitOrder')).toBeEnabled();
  expect(requests).toBe(1);
});

test('missing API configuration keeps ordering disabled with actionable feedback', async ({ page }) => {
  await page.route('**/config.js', (route) => route.fulfill({
    contentType: 'application/javascript', body: 'window.SNACKIFY_CONFIG = {};'
  }));
  await page.goto('/menu.html');
  await expect(page.locator('#submitOrder')).toBeDisabled();
  await expect(page.locator('#orderStatus')).toContainText('configuration could not be loaded');
});

test('without JavaScript, the site stays styled and cannot submit personal details', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/menu.html');
  await expect(page.locator('nav')).toHaveCSS('display', 'flex');
  expect(await page.content()).toContain('JavaScript is required');
  await expect(page.locator('#submitOrder')).toBeDisabled();
  await expect(page.locator('#name')).not.toHaveAttribute('name');
  await expect(page.locator('#phone')).not.toHaveAttribute('name');
  await context.close();
});
