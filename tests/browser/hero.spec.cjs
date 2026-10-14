const { test, expect } = require('@playwright/test');

test('the homepage has a clean centered donut video hero', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const hero = page.locator('#hero');
  const media = page.locator('.hero__media');
  const video = page.locator('#hero-video');

  await expect(video).toHaveAttribute('src', 'donut.mp4');
  await expect(hero).toHaveAttribute('data-media', 'video', { timeout: 20000 });
  await expect(page.locator('.hero__poster')).toHaveCount(0);
  await expect(page.locator('.hero__video')).toBeVisible();
  await expect(page.locator('.hero__copy')).toHaveCount(0);
  await expect(page.locator('.hero__halo')).toHaveCount(0);
  await expect(page.locator('.hero__shade')).toHaveCount(0);

  const state = await page.evaluate(() => {
    const mediaBox = document.querySelector('.hero__media').getBoundingClientRect();
    const video = document.querySelector('#hero-video');
    return {
      heroHeight: document.querySelector('#hero').offsetHeight,
      centeredX: Math.abs((mediaBox.left + mediaBox.right) / 2 - innerWidth / 2) < 2,
      centeredY: Math.abs((mediaBox.top + mediaBox.bottom) / 2 - innerHeight / 2) < 2,
      videoLoaded: video.videoWidth > 0,
      videoPaused: video.paused,
      videoOpacity: getComputedStyle(video).opacity,
      videoFilter: getComputedStyle(video).filter,
      mediaWidth: mediaBox.width,
      mediaHeight: mediaBox.height,
      overflow: document.documentElement.scrollWidth > innerWidth
    };
  });

  expect(state.heroHeight).toBeGreaterThan(1500);
  expect(state.centeredX).toBe(true);
  expect(state.centeredY).toBe(true);
  expect(state.videoLoaded).toBe(true);
  expect(state.videoPaused).toBe(true);
  expect(state.videoOpacity).toBe('1');
  expect(state.videoFilter).toBe('none');
  expect(state.mediaWidth).toBe(1440);
  expect(state.mediaHeight).toBe(900);
  expect(state.overflow).toBe(false);
});

test('the video stays paused until scroll and scrubs with the page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#hero')).toHaveAttribute('data-media', 'video', { timeout: 20000 });
  const initialTime = await page.locator('#hero-video').evaluate((video) => video.currentTime);

  await page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(() => page.locator('#hero-video').evaluate((video) => video.currentTime)).toBeGreaterThan(initialTime);
  expect(await page.locator('#hero-video').evaluate((video) => video.paused)).toBe(true);
  expect(await page.locator('#hero').getAttribute('data-motion')).toBe('scroll');
});

test('the simple hero remains usable at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  const state = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    mediaWidth: document.querySelector('.hero__media').getBoundingClientRect().width,
    videoWidth: document.querySelector('#hero-video').getBoundingClientRect().width
  }));
  expect(state.overflow).toBe(false);
  expect(state.mediaWidth).toBeLessThanOrEqual(320);
  expect(state.videoWidth).toBeGreaterThan(0);
});

test('a missing video leaves a clean centered stage without broken controls', async ({ page }) => {
  await page.route('**/donut.mp4', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.locator('#hero')).toHaveAttribute('data-motion', 'unavailable');
  await expect(page.locator('#hero')).toHaveAttribute('data-media', 'poster');
  await expect(page.locator('.hero__poster')).toHaveCount(0);
  await expect(page.locator('.hero__media')).toBeVisible();
});
