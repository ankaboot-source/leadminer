// eslint-disable-next-line no-unused-vars
const { GoogleController } = require('./controllers/GoogleController');

const express = require('express');

/**
 *
 * @param {GoogleController} googleController
 */
const buildApp = (googleController) => {
  const app = express();

  app.use('/test/signup', googleController.signUp);

  return app;
};

module.exports = { buildApp };
