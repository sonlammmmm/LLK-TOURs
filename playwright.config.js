// eslint-disable-next-line node/no-unpublished-require, import/no-extraneous-dependencies
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/playwright',
  timeout: 30000,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    headless: false,
    viewport: { width: 1200, height: 720 },
    trace: 'on-first-retry'
  }
});
