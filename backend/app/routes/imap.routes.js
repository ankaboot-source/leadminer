module.exports = (app) => {
  const imap = require("../controllers/imap.controller.js");

  var router = require("express").Router();

  // Create a new imap account
  router.post("/", imap.createImapInfo);

  // // Retrieve all imap accounts
  // router.get("/", imap.findAll);

  // // Retrieve a single imap account with id
  // router.get("/:id", imap.findOne);

  // Retrieve emails based on user prefrences for a given imap account
  router.get("/:id/boxes", imap.getImapBoxes);

  // Retrieve emails based on user prefrences for a given imap account
  router.get("/:id/emails", imap.getEmails);

  //router.post("/imap", imap.imapCredentials);

  // // Update a Tutorial with id
  // router.put("/:id", imap.update);

  // // Delete a Tutorial with id
  // router.delete("/:id", imap.delete);

  // // Delete all imap
  // router.delete("/", imap.deleteAll);

  app.use("/api/imap", router);
};
