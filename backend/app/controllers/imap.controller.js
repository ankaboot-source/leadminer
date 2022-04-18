const Imap = require("imap");
const db = require("../models");
const ImapInfo = db.imapInfo;
const logger = require("../utils/logger")(module);
var qualificationServices = require("../services/dataQualificationService");
const UtilsForData = require("../utils/inputHelpers");
const imapService = require("../services/imapService");
/**
 *  Create imap info account.
 * @param  {} req
 * @param  {} res
 */
exports.createImapInfo = (req, res) => {
  if (!req.body.email || !req.body.host || !req.body.port) {
    res.status(400).send({
      error: "Content can not be empty!",
    });
    return;
  }
  // imapInfo object
  const imapInfo = {
    email: req.body.email,
    host: req.body.host,
    port: req.body.port,
    tls: req.body.tls ? req.body.tls : true,
  };
  // initiate imap client
  const imap = new Imap({
    user: imapInfo.email,
    password: req.body.password,
    host: imapInfo.host,
    port: imapInfo.port,
    tls: imapInfo.tls,
  });
  // Ensures that the account exists
  imap.connect();
  // if we can connect to the imap account
  imap.once("ready", () => {
    ImapInfo.findOne({ where: { email: imapInfo.email } }).then((imapdata) => {
      if (imapdata === null) {
        // Save ImapInfo in the database
        ImapInfo.create(imapInfo)
          .then((data) => {
            res.status(200).send({ imapdata: data });
          })
          .catch((err) => {
            logger.error(`can't create account with email ${req.body.email}`);
            res.status(500).send({
              error:
                "Some error occurred while creating your account imap info.",
            });
          });
      } else {
        logger.info(
          `On signup : Account with email ${req.body.email} already exist`
        );
        res.status(200).send({
          message: "Your account already exists !",
          imapdata,
        });
      }
      imap.end();
    });
  });
  // The imap account does not exists or connexion denied
  imap.once("error", () => {
    logger.error(
      `Can't connect to imap account with email ${req.body.email} and host ${req.body.host}`
    );
    res.status(500).send({
      message: "We can't connect to your imap account.",
    });
  });
};
/**
 * Login to account
 * @param  {} req
 * @param  {} res
 */
exports.loginToAccount = (req, res) => {
  if (!req.body.email) {
    res.status(400).send({
      error: "Content can not be empty!",
    });
    return;
  }
  ImapInfo.findOne({ where: { email: req.body.email } }).then((imap) => {
    if (imap === null) {
      logger.error(
        `On login : Account with email ${req.body.email} does not exist`
      );
      res.status(500).send({
        error: "Your account does not exist ! try to sign up.",
      });
    } else {
      logger.info(`Account with email ${req.body.email} succesfully logged in`);
      res.status(200).send({
        message: "Welcome back !",
        imap,
      });
    }
  });
};

/**
 * Retrieve mailbox files.
 * @param  {} req
 * @param  {} res
 */
exports.getImapBoxes = async (req, res) => {
  // retrive imap connection infos from database
  ImapInfo.findByPk(req.params.id)
    .then((imapInfo) => {
      const imap = new Imap({
        user: imapInfo.email,
        password: req.query.password,
        host: imapInfo.host,
        port: imapInfo.port,
        tls: true,
        tlsOptions: {
          port: 993,
          host: imapInfo.host,
          servername: imapInfo.host,
        },
      });
      let Boxes = [];
      imap.connect();
      imap.once("ready", () => {
        logger.info(
          `Begin fetching folders names from imap account with email : ${imapInfo.email}`
        );
        imap.getBoxes("", (err, boxes) => {
          Boxes = UtilsForData.getBoxesAll(boxes);
        });
        imap.end();
      });
      imap.once("error", (err) => {
        console.log(err);
        logger.error(
          `error occured when trying to connect to imap account with email : ${imapInfo.email}`
        );
        res.status(500).send({
          error: err,
        });
      });
      imap.once("end", () => {
        logger.info(
          `End fetching folders names from imap account with email : ${imapInfo.email}`
        );
        if (Boxes.length > 0) {
          res.status(200).send({
            boxes: Boxes,
          });
        } else {
          res.status(204).send({
            error: "No boxes found!",
          });
        }
      });
    })
    .catch(() => {
      logger.error(`No account with email : ${req.params.id} found`);
      res.status(404).send({
        error: `No account with id : ${req.params.id} found`,
      });
    });
};
/**
 * Get Emails from imap server.
 * @param  {} req
 * @param  {} res
 * @param  {} sse server sent event
 * @param  {} RedisClient redis RedisClient
 */
exports.getEmails = (req, res, sse, RedisClient) => {
  if (req.query.password) {
    // fetch imap from database then mine Emails
    ImapInfo.findByPk(req.params.id).then((imapInfo) => {
      // data will include all of the data that will be mined from the mailbox.
      (i = 0), (boxes = UtilsForData.getBoxesAndFolders(req.query));
      // bodiesTofetch is the query that user sends
      const bodiesTofetch = req.query.fields;

      imapService.imapService(
        bodiesTofetch,
        boxes,
        imapInfo,
        RedisClient,
        sse,
        req.query
      );
    });
  }
};
