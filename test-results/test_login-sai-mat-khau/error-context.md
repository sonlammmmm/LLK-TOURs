# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test_login.spec.js >> sai mat khau
- Location: tests\playwright\test_login.spec.js:104:1

# Error details

```
Error: page.goto: Target page, context or browser has been closed
Call log:
  - navigating to "http://localhost:3000/login", waiting until "load"

```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | 
  3   | const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  4   | const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gmail.com';
  5   | const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '12345678';
  6   | const USER_EMAIL = process.env.USER_EMAIL || 'vannam.bui@example.com';
  7   | const USER_PASSWORD = process.env.USER_PASSWORD || 'slam7424';
  8   | 
  9   | async function openLogin(page) {
> 10  |   await page.goto(`${BASE_URL}/login`);
      |              ^ Error: page.goto: Target page, context or browser has been closed
  11  |   await page.waitForSelector('#email', { state: 'visible' });
  12  |   await page.waitForSelector('#password', { state: 'visible' });
  13  | }
  14  | 
  15  | async function fillLoginForm(page, email, password) {
  16  |   const emailInput = page.locator('#email');
  17  |   const passwordInput = page.locator('#password');
  18  |   await emailInput.fill('');
  19  |   await passwordInput.fill('');
  20  |   if (email !== null && email !== undefined) {
  21  |     await emailInput.fill(email);
  22  |   }
  23  |   if (password !== null && password !== undefined) {
  24  |     await passwordInput.fill(password);
  25  |   }
  26  |   return { emailInput, passwordInput };
  27  | }
  28  | 
  29  | async function submitLogin(page) {
  30  |   await page.click('form.form--login button.btn.auth-btn');
  31  | }
  32  | 
  33  | async function waitForSuccessAlert(page) {
  34  |   await page.waitForSelector('.alert.alert--success', { state: 'visible' });
  35  | }
  36  | 
  37  | async function waitForErrorAlert(page) {
  38  |   await page.waitForSelector('.alert.alert--error', { state: 'visible' });
  39  | }
  40  | 
  41  | async function waitForAnyAlert(page) {
  42  |   await Promise.race([
  43  |     page.waitForSelector('.alert.alert--success', { state: 'visible' }),
  44  |     page.waitForSelector('.alert.alert--error', { state: 'visible' })
  45  |   ]);
  46  | }
  47  | 
  48  | async function getAlertText(page, alertType) {
  49  |   const alert = page.locator(`.alert.alert--${alertType} .alert__message`);
  50  |   return (await alert.textContent())?.trim() || '';
  51  | }
  52  | 
  53  | test('dang nhap admin thanh cong', async ({ page }) => {
  54  |   await openLogin(page);
  55  |   await fillLoginForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  56  |   await submitLogin(page);
  57  | 
  58  |   await waitForSuccessAlert(page);
  59  |   await page.waitForURL('**/admin/dashboard');
  60  |   await expect(page).toHaveURL(/\/admin\/dashboard/);
  61  | });
  62  | 
  63  | test('dang nhap user thanh cong', async ({ page }) => {
  64  |   await openLogin(page);
  65  |   await fillLoginForm(page, USER_EMAIL, USER_PASSWORD);
  66  |   await submitLogin(page);
  67  | 
  68  |   await waitForAnyAlert(page);
  69  |   const errorAlerts = page.locator('.alert.alert--error');
  70  |   if ((await errorAlerts.count()) > 0) {
  71  |     const errorText = await getAlertText(page, 'error');
  72  |     throw new Error(`Dang nhap user that bai: ${errorText}`);
  73  |   }
  74  | 
  75  |   await waitForSuccessAlert(page);
  76  |   await page.waitForURL(url => !url.toString().includes('/login'));
  77  |   await expect(page).not.toHaveURL(/\/login/);
  78  | });
  79  | 
  80  | test('thieu email', async ({ page }) => {
  81  |   await openLogin(page);
  82  |   const { emailInput } = await fillLoginForm(page, '', USER_PASSWORD);
  83  |   await submitLogin(page);
  84  | 
  85  |   const validationMessage = await emailInput.evaluate(
  86  |     el => el.validationMessage
  87  |   );
  88  |   expect(validationMessage).toBeTruthy();
  89  |   await expect(page).toHaveURL(/\/login/);
  90  | });
  91  | 
  92  | test('thieu mat khau', async ({ page }) => {
  93  |   await openLogin(page);
  94  |   const { passwordInput } = await fillLoginForm(page, USER_EMAIL, '');
  95  |   await submitLogin(page);
  96  | 
  97  |   const validationMessage = await passwordInput.evaluate(
  98  |     el => el.validationMessage
  99  |   );
  100 |   expect(validationMessage).toBeTruthy();
  101 |   await expect(page).toHaveURL(/\/login/);
  102 | });
  103 | 
  104 | test('sai mat khau', async ({ page }) => {
  105 |   await openLogin(page);
  106 |   await fillLoginForm(page, USER_EMAIL, 'wrong-password');
  107 |   await submitLogin(page);
  108 | 
  109 |   await waitForErrorAlert(page);
  110 |   await expect(page).toHaveURL(/\/login/);
```