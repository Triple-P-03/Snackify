const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run build && npx --no-install serve dist --listen tcp://127.0.0.1:4173 --no-clipboard',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120000
  }
});
