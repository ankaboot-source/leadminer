module.exports = (app, sse, client) => {
  const imap = require("../controllers/imap.controller");
  const googleApiController = require("../controllers/google.controller.js");
  const router = require("express").Router();

  // Create a new imap account
  router.post("/signup", imap.createImapInfo);
  // signUp with google account route
  router.post("/signUpGoogle", (req, res) => {
    googleApiController.SignUpWithGoogle(req, res);
  });
  // login into account
  router.post("/login", imap.loginToAccount);
  // Retrieve emails based on user prefrences for a given imap account
  router.get("/:id/boxes", (req, res) => {
    imap.getImapBoxes(req, res, sse);
  });
  // Retrieve emails based on user prefrences for a given imap account
  router.get("/:id/collectEmails", (req, res) => {
    imap.getEmails(req, res, sse, client);
  });

  app.use("/api/imap", router);
};
