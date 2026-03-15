import passportStub from 'passport-stub';

/**
 * Utility to mock OAuth logins for testing
 */
const OAuthMock = {
  /**
   * Initialize passport stub on the app
   * @param {Object} app - Express application instance
   */
  install: (app) => {
    passportStub.install(app);
  },

  /**
   * Mock a successful login
   * @param {Object} user - User object to inject into session
   */
  login: (user) => {
    passportStub.login(user);
  },

  /**
   * Log out the mocked user
   */
  logout: () => {
    passportStub.logout();
  },

  /**
   * Uninstall passport stub
   */
  uninstall: () => {
    passportStub.uninstall();
  }
};

export default OAuthMock;
