/* eslint-disable no-undef */
/* eslint-env cypress */

describe('Dang nhap', () => {
  const selectors = {
    email: '#email',
    password: '#password',
    submit: 'form.form--login button.btn.auth-btn',
    successAlert: '.alert.alert--success',
    errorAlert: '.alert.alert--error'
  };

  const creds = {
    adminEmail: Cypress.env('ADMIN_EMAIL'),
    adminPassword: Cypress.env('ADMIN_PASSWORD'),
    userEmail: Cypress.env('USER_EMAIL'),
    userPassword: Cypress.env('USER_PASSWORD')
  };

  const openLogin = () => {
    cy.visit('/login');
    cy.get(selectors.email).should('be.visible');
    cy.get(selectors.password).should('be.visible');
  };

  const fillLoginForm = (email, password) => {
    const emailValue = email ?? '';
    const passwordValue = password ?? '';

    cy.get(selectors.email).clear();
    if (emailValue !== '') {
      cy.get(selectors.email).type(emailValue);
    }

    cy.get(selectors.password).clear();
    if (passwordValue !== '') {
      cy.get(selectors.password).type(passwordValue);
    }
  };

  const submitLogin = () => {
    cy.get(selectors.submit).click();
  };

  it('dang nhap admin thanh cong', () => {
    openLogin();
    fillLoginForm(creds.adminEmail, creds.adminPassword);
    submitLogin();

    cy.get(selectors.successAlert).should('be.visible');
    cy.url().should('include', '/admin/dashboard');
  });

  it('dang nhap user thanh cong', () => {
    openLogin();
    fillLoginForm(creds.userEmail, creds.userPassword);
    submitLogin();

    cy.get('body').then($body => {
      if ($body.find(selectors.errorAlert).length > 0) {
        const errorText = $body
          .find(`${selectors.errorAlert} .alert__message`)
          .text()
          .trim();
        throw new Error(`Dang nhap user that bai: ${errorText}`);
      }
    });

    cy.get(selectors.successAlert).should('be.visible');
    cy.url().should('not.include', '/login');
  });

  it('thieu email', () => {
    openLogin();
    fillLoginForm('', creds.userPassword);
    submitLogin();

    cy.get(selectors.email)
      .invoke('prop', 'validationMessage')
      .should(message => {
        expect(message).to.not.equal('');
      });
    cy.url().should('include', '/login');
  });

  it('thieu mat khau', () => {
    openLogin();
    fillLoginForm(creds.userEmail, '');
    submitLogin();

    cy.get(selectors.password)
      .invoke('prop', 'validationMessage')
      .should(message => {
        expect(message).to.not.equal('');
      });
    cy.url().should('include', '/login');
  });

  it('sai mat khau', () => {
    openLogin();
    fillLoginForm(creds.userEmail, 'wrong-password');
    submitLogin();

    cy.get(selectors.errorAlert).should('be.visible');
    cy.url().should('include', '/login');
  });

  it('email sai dinh dang', () => {
    openLogin();
    fillLoginForm('notanemail', creds.userPassword);
    submitLogin();

    cy.get(selectors.email)
      .invoke('prop', 'validationMessage')
      .should(message => {
        expect(message).to.not.equal('');
      });
    cy.url().should('include', '/login');
  });
});
