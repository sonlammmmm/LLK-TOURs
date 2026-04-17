import os
import unittest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


BASE_URL = os.getenv("BASE_URL", "http://localhost:3000")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@gmail.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "12345678")
USER_EMAIL = os.getenv("USER_EMAIL", "vannam.bui@example.com")
USER_PASSWORD = os.getenv("USER_PASSWORD", "slam7424")


def create_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--window-size=1280,800")
    # Uncomment to run headless
    # options.add_argument("--headless=new")
    return webdriver.Chrome(options=options)


class LoginTests(unittest.TestCase):
    def setUp(self):
        self.driver = create_driver()
        self.wait = WebDriverWait(self.driver, 10)

    def tearDown(self):
        self.driver.quit()

    def open_login(self):
        self.driver.get(f"{BASE_URL}/login")
        self.wait.until(EC.visibility_of_element_located((By.ID, "email")))
        self.wait.until(EC.visibility_of_element_located((By.ID, "password")))

    def fill_login_form(self, email, password):
        email_input = self.driver.find_element(By.ID, "email")
        password_input = self.driver.find_element(By.ID, "password")
        email_input.clear()
        password_input.clear()
        if email is not None:
            email_input.send_keys(email)
        if password is not None:
            password_input.send_keys(password)
        return email_input, password_input

    def submit_login(self):
        self.driver.find_element(By.CSS_SELECTOR, "form.form--login button.btn.auth-btn").click()

    def wait_for_success_alert(self):
        self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".alert.alert--success")))

    def wait_for_error_alert(self):
        self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".alert.alert--error")))

    def wait_for_url_contains(self, path_fragment):
        self.wait.until(EC.url_contains(path_fragment))

    def wait_for_any_alert(self):
        self.wait.until(
            EC.any_of(
                EC.visibility_of_element_located((By.CSS_SELECTOR, ".alert.alert--success")),
                EC.visibility_of_element_located((By.CSS_SELECTOR, ".alert.alert--error")),
            )
        )

    def get_alert_text(self, alert_type):
        alert = self.driver.find_element(By.CSS_SELECTOR, f".alert.alert--{alert_type} .alert__message")
        return alert.text.strip()

    def test_login_admin_success(self):
        self.open_login()
        self.fill_login_form(ADMIN_EMAIL, ADMIN_PASSWORD)
        self.submit_login()

        self.wait_for_success_alert()
        self.wait_for_url_contains("/admin/dashboard")
        self.assertIn("/admin/dashboard", self.driver.current_url)

    def test_login_user_success(self):
        self.open_login()
        self.fill_login_form(USER_EMAIL, USER_PASSWORD)
        self.submit_login()

        self.wait_for_any_alert()
        error_alerts = self.driver.find_elements(By.CSS_SELECTOR, ".alert.alert--error")
        if error_alerts:
            error_text = self.get_alert_text("error")
            self.fail(f"Dang nhap user that bai: {error_text}")

        self.wait_for_success_alert()
        self.wait.until(lambda d: "/login" not in d.current_url)
        self.assertNotIn("/login", self.driver.current_url)

    def test_login_missing_email(self):
        self.open_login()
        email_input, _ = self.fill_login_form("", USER_PASSWORD)
        self.submit_login()

        validation_message = email_input.get_attribute("validationMessage")
        self.assertTrue(validation_message)
        self.assertIn("/login", self.driver.current_url)

    def test_login_missing_password(self):
        self.open_login()
        _, password_input = self.fill_login_form(USER_EMAIL, "")
        self.submit_login()

        validation_message = password_input.get_attribute("validationMessage")
        self.assertTrue(validation_message)
        self.assertIn("/login", self.driver.current_url)

    def test_login_wrong_password(self):
        self.open_login()
        self.fill_login_form(USER_EMAIL, "wrong-password")
        self.submit_login()

        self.wait_for_error_alert()
        self.assertIn("/login", self.driver.current_url)

    def test_login_invalid_email_format(self):
        self.open_login()
        email_input, _ = self.fill_login_form("notanemail", USER_PASSWORD)
        self.submit_login()

        validation_message = email_input.get_attribute("validationMessage")
        self.assertTrue(validation_message)
        self.assertIn("/login", self.driver.current_url)


if __name__ == "__main__":
    unittest.main(verbosity=2)
