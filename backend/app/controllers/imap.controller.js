const Imap = require("imap");
const db = require("../models");
const ImapInfo = db.imapInfo;
const logger = require("../utils/logger")(module);
const UtilsForData = require("../utils/inputHelpers");
const imapService = require("../services/imapService");
const xoauth2 = require("xoauth2");
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
    tls: true,
    connTimeout: 20000,
    authTimeout: 7000,
    tlsOptions: {
      port: imapInfo.port,
      host: imapInfo.host,
      servername: imapInfo.host,
    },
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
            logger.error(
              `can't create account with email ${req.body.email} : ${err}`
            );
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
          switch: true,
          imapdata,
        });
      }
      imap.end();
    });
  });
  // The imap account does not exists or connexion denied
  imap.once("error", (err) => {
    logger.error(
      `Can't connect to imap account with email ${req.body.email} and host ${req.body.host}  : **Error** ${err}`
    );
    res.status(500).send({
      error: "We can't connect to your imap account.",
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
      const imapConnection = new Imap({
        user: imap.email,
        password: req.body.password,
        host: imap.host,
        port: imap.port,
        tls: true,
        connTimeout: 20000,
        authTimeout: 7000,
        tlsOptions: {
          port: imap.port,
          host: imap.host,
          servername: imap.host,
        },
      });
      imapConnection.connect();
      imapConnection.once("ready", () => {
        if (imap) {
          logger.info(
            `Account with email ${req.body.email} succesfully logged in`
          );
          res.status(200).send({
            imap,
          });
          imapConnection.end();
        }
      });
      imapConnection.on("error", (err) => {
        logger.error(
          `Can't connect to imap account with email ${req.body.email} and host ${req.body.host} : **Error** ${err}`
        );
        res.status(500).send({
          error: "We can't connect to your imap account, Check credentials.",
        });
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
  var imap;
  /* eslint-disable */
  var specialChar = `\x01\x01`;
  /* eslint-disable */
  var bearerString = `\x01auth=Bearer `;
  //case: token based authentication
  if (req.query.token) {
    xoauth2gen = xoauth2.createXOAuth2Generator({
      user: req.query.userEmail,
      clientId: process.env.GG_CLIENT_ID,
      clientSecret: process.env.GG_CLIENT_SECRET,
      accessToken: req.query.token,
    });

    var authData =
      "user=" +
      req.query.userEmail +
      bearerString +
      xoauth2gen.accessToken +
      specialChar;
    var xoauth2_token = new Buffer.from(authData, "utf-8").toString("base64");
    imap = new Imap({
      user: req.query.userEmail,
      xoauth2: xoauth2_token,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: {
        port: 993,
        host: "imap.gmail.com",
        servername: "imap.gmail.com",
      },
    });
  }
  //case: password based authentication
  else {
    try {
      let imapInfo = await ImapInfo.findByPk(req.query.userId);
      imap = new Imap({
        user: imapInfo.email,
        password: req.query.password,
        host: imapInfo.host,
        port: imapInfo.port,
        tls: true,
        tlsOptions: {
          port: imapInfo.port,
          host: imapInfo.host,
          servername: imapInfo.host,
        },
      });
    } catch {
      logger.error(`No account with email : ${req.params.id} found`);
      res.status(404).send({
        error: `No account with id : ${req.params.id} found`,
      });
    }
  }
  let Boxes = [];
  // try connection to imap server
  imap.connect();
  imap.once("ready", () => {
    logger.info(
      `Begin fetching folders names from imap account with email : ${req.query.userEmail}`
    );
    imap.getBoxes("", (err, boxes) => {
      Boxes = UtilsForData.getBoxesAll(boxes);
      function iterate(obj) {
        obj.map((key) => {
          //console.log(obj[key]);
          if (key.hasOwnProperty("children")) {
            let name = UtilsForData.getPath({ ...Boxes }, key.label);
            imap.openBox(name.substring(1), true, (err, box) => {
              if (box) {
                key["total"] = box.messages.total;
              }
              if (key == obj[obj.length - 1]) {
                imap.end();
              }
            });
            iterate(key.children);
          } else {
            let name = UtilsForData.getPath({ ...Boxes }, key.label);
            imap.openBox(name.substring(1), true, (err, box) => {
              if (box) {
                key["total"] = box.messages.total;
              }
              console.log(key == obj[obj.length - 1]);
              if (key == obj[obj.length - 1]) {
                imap.end();
              }
            });
          }
        });
      }
      iterate(Boxes);
    });
  });
  imap.once("error", (err) => {
    logger.error(
      `error occured when trying to connect to imap account with email : ${req.query.userEmail} : **Error** ${err}`
    );
  });
  imap.once("end", () => {
    logger.info(
      `End fetching folders names from imap account with email : ${req.query.userEmail}`
    );
    if (Boxes.length > 0) {
      res.status(200).send({
        boxes: Boxes,
        message: "End fetching boxes!",
      });
    } else {
      res.status(204).send({
        error: "No boxes found!",
      });
    }
  });
};
/**
 * Get Emails from imap server.
 * @param  {} req
 * @param  {} res
 * @param  {} sse server sent event instance
 * @param  {} RedisClient redis client
 */
exports.getEmails = (req, res, sse, RedisClient) => {
  // case : password authentication
  if (req.query.password) {
    // fetch imap from database then mine Emails
    ImapInfo.findByPk(req.params.id).then((imapInfo) => {
      // data will include all of the data that will be mined from the mailbox.
      let boxes = UtilsForData.getBoxesAndFolders(req.query);
      // bodiesTofetch is the query that user sends
      const bodiesTofetch = req.query.fields;
      imapService.imapService(
        bodiesTofetch,
        boxes,
        imapInfo,
        RedisClient,
        sse,
        req.query,
        res,
        req
      );
      delete req, res;
    });
  } // case : token based authentication
  else {
    let boxes = UtilsForData.getBoxesAndFolders(req.query);
    // bodiesTofetch is the query that user sends
    const bodiesTofetch = req.query.fields;
    imapService.imapService(
      bodiesTofetch,
      boxes,
      req.query.userEmail,
      RedisClient,
      sse,
      req.query,
      res,
      req
    );
  }
};
