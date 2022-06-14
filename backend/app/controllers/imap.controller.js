/* istanbul ignore file */
const Imap = require("imap");
const db = require("../models");
const ImapInfo = db.imapInfo;
const googleUser = db.googleUsers;
const logger = require("../utils/logger")(module);
const UtilsForData = require("../utils/inputHelpers");
const utilsForToken = require("../utils/tokenHelpers");
const hashHelpers = require("../utils/hashHelpers");
const imapService = require("../services/imapService");
const ImapUser = require("../services/imapUser");
const EmailServer = require("../services/EmailServer");
const EmailAccountMiner = require("../services/EmailAccountMiner");
/**
 *  Create imap account infos
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
 * Retrieve mailbox folders.
 * @param  {object} req - user request
 * @param  {object} res - http response to be sent
 */
exports.getImapBoxes = async (req, res) => {
  // define user object from user request query
  let user = new ImapUser(req.query).getUserConnetionDataFromQuery();
  // initialise imap server connection
  let imapConnection = new EmailServer(user).getConnection();
  // initialise EmailAccountMiner to mine imap tree
  let miner = new EmailAccountMiner(imapConnection, user, {}, {}, "", "", "");
  // get tree
  let [tree, error] = await miner.getTree();
  if (error) {
    logger.error(
      `Mining imap tree failed for user with email ${hashHelpers.hashEmail(
        user.email
      )} reason : ${error}`
    );
    res.status(400).send({
      message: "Can't fetch imap folders",
      error: error,
    });
  }
  if (tree) {
    logger.info(
      `Mining imap tree succeded for user with email ${hashHelpers.hashEmail(
        user.email
      )}`
    );
    res.status(200).send({
      message: "Imap folders fetched with success !",
      imapFoldersTree: tree,
    });
  }
};

/**
 * Get Emails from imap server.
 * @param  {object} req - user request
 * @param  {object} res - http response to be sent
 * @param  {object} sse - server sent event instance
 * @param  {object} RedisClient - redis client
 */
exports.getEmails = (req, res, sse, RedisClient) => {
  if (!req.query) {
    logger.error(
      `No user query param ! request can't be handled without a user`
    );
    return res.status(404).send({
      message: "Bad request",
      error: "Bad request! check query",
    });
  }
  // define user object from user request query
  let user = new ImapUser(req.query).getUserConnetionDataFromQuery();
  // if (user && !req.query.fields) {
  //   logger.error(
  //     `Request failed for user with email ${hashHelpers.hashEmail(
  //       user.email
  //     )} reason : empty fields`
  //   );
  //   return res.status(404).send({
  //     message: "Fields to be fetched can't be empty !",
  //     error: "empty fields",
  //   });
  // }
  // initialise imap server connection
  let imapConnection = new EmailServer(user).getConnection();
  // initialise EmailAccountMiner to mine imap tree
  let miner = new EmailAccountMiner(
    imapConnection,
    user,
    RedisClient,
    sse,
    ["HEADER"],
    ["INBOX"],
    "",
    20
  );
  miner.mine();
  // case : password authentication
  // if (req.query.password) {
  //   // fetch imap from database then mine Emails
  //   ImapInfo.findByPk(req.params.id)
  //     .then((imapUser) => {
  //       // data will include all of the data that will be mined from the mailbox.
  //       let boxes = UtilsForData.getBoxesAndFolders(req.query);
  //       // bodiesTofetch is the query that user sends
  //       const bodiesTofetch = req.query.fields;
  //       imapService.imapService(
  //         bodiesTofetch,
  //         boxes,
  //         imapUser,
  //         RedisClient,
  //         sse,
  //         req.query,
  //         res,
  //         req
  //       );
  //     })
  //     .catch((err) => {
  //       res.status(404).send({
  //         error: `No account with id : ${req.params.id} found`,
  //       });
  //     });
  // } // case : token based authentication
  // else {
  //   let boxes = UtilsForData.getBoxesAndFolders(req.query);
  //   // bodiesTofetch is the query that user sends
  //   const bodiesTofetch = req.query.fields;
  //   let user = JSON.parse(JSON.parse(JSON.stringify(req.query.user)));
  //   googleUser
  //     .findByPk(user.id)
  //     .then((googleUser) => {
  //       user["refreshToken"] = googleUser.dataValues.refreshToken;
  //       if (googleUser) {
  //         imapService.imapService(
  //           bodiesTofetch,
  //           boxes,
  //           user,
  //           RedisClient,
  //           sse,
  //           req.query,
  //           res,
  //           req
  //         );
  //       } else {
  //         res.status(404).send({
  //           error: `No account with id : ${user.id} found`,
  //         });
  //       }
  //     })
  //     .catch(() => {
  //       res.status(404).send({
  //         error: `No account with id : ${user.id} found`,
  //       });
  //     });
  // }
};
