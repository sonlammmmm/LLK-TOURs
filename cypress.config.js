// eslint-disable-next-line import/no-extraneous-dependencies, node/no-unpublished-require
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  env: {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@gmail.com',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '12345678',
    USER_EMAIL: process.env.USER_EMAIL || 'vannam.bui@example.com',
    USER_PASSWORD: process.env.USER_PASSWORD || 'slam7424'
  },
  viewportWidth: 1280,
  viewportHeight: 800,
  e2e: {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    setupNodeEvents(on, config) {
      return config;
    }
  }
});
