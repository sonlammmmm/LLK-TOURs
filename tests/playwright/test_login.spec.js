const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '12345678';
const USER_EMAIL = process.env.USER_EMAIL || 'vannam.bui@example.com';
const USER_PASSWORD = process.env.USER_PASSWORD || 'slam7424';

async function openLogin(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('#email', { state: 'visible' });
  await page.waitForSelector('#password', { state: 'visible' });
}

async function fillLoginForm(page, email, password) {
  const emailInput = page.locator('#email');
  const passwordInput = page.locator('#password');
  await emailInput.fill('');
  await passwordInput.fill('');
  if (email !== null && email !== undefined) {
    await emailInput.fill(email);
  }
  if (password !== null && password !== undefined) {
    await passwordInput.fill(password);
  }
  return { emailInput, passwordInput };
}

async function submitLogin(page) {
  await page.click('form.form--login button.btn.auth-btn');
}

async function waitForSuccessAlert(page) {
  await page.waitForSelector('.alert.alert--success', { state: 'visible' });
}

async function waitForErrorAlert(page) {
  await page.waitForSelector('.alert.alert--error', { state: 'visible' });
}

async function waitForAnyAlert(page) {
  await Promise.race([
    page.waitForSelector('.alert.alert--success', { state: 'visible' }),
    page.waitForSelector('.alert.alert--error', { state: 'visible' })
  ]);
}

async function getAlertText(page, alertType) {
  const alert = page.locator(`.alert.alert--${alertType} .alert__message`);
  return (await alert.textContent())?.trim() || '';
}

test('dang nhap admin thanh cong', async ({ page }) => {
  await openLogin(page);
  await fillLoginForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await submitLogin(page);

  await waitForSuccessAlert(page);
  await page.waitForURL('**/admin/dashboard');
  await expect(page).toHaveURL(/\/admin\/dashboard/);
});

test('dang nhap user thanh cong', async ({ page }) => {
  await openLogin(page);
  await fillLoginForm(page, USER_EMAIL, USER_PASSWORD);
  await submitLogin(page);

  await waitForAnyAlert(page);
  const errorAlerts = page.locator('.alert.alert--error');
  if ((await errorAlerts.count()) > 0) {
    const errorText = await getAlertText(page, 'error');
    throw new Error(`Dang nhap user that bai: ${errorText}`);
  }

  await waitForSuccessAlert(page);
  await page.waitForURL(url => !url.toString().includes('/login'));
  await expect(page).not.toHaveURL(/\/login/);
});

test('thieu email', async ({ page }) => {
  await openLogin(page);
  const { emailInput } = await fillLoginForm(page, '', USER_PASSWORD);
  await submitLogin(page);

  const validationMessage = await emailInput.evaluate(
    el => el.validationMessage
  );
  expect(validationMessage).toBeTruthy();
  await expect(page).toHaveURL(/\/login/);
});

test('thieu mat khau', async ({ page }) => {
  await openLogin(page);
  const { passwordInput } = await fillLoginForm(page, USER_EMAIL, '');
  await submitLogin(page);

  const validationMessage = await passwordInput.evaluate(
    el => el.validationMessage
  );
  expect(validationMessage).toBeTruthy();
  await expect(page).toHaveURL(/\/login/);
});

test('sai mat khau', async ({ page }) => {
  await openLogin(page);
  await fillLoginForm(page, USER_EMAIL, 'wrong-password');
  await submitLogin(page);

  await waitForErrorAlert(page);
  await expect(page).toHaveURL(/\/login/);
});

test('email sai dinh dang', async ({ page }) => {
  await openLogin(page);
  const { emailInput } = await fillLoginForm(page, 'notanemail', USER_PASSWORD);
  await submitLogin(page);

  const validationMessage = await emailInput.evaluate(
    el => el.validationMessage
  );
  expect(validationMessage).toBeTruthy();
  await expect(page).toHaveURL(/\/login/);
});
