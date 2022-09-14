const Imap = require("imap");
const db = require("../models"),
  ImapInfo = db.imapInfo,
  googleUser = db.googleUsers,
  logger = require("../utils/logger")(module);
const hashHelpers = require("../utils/hashHelpers");
const minedDataHelpers = require("../utils/minedDataHelpers");
const EventEmitter = require("node:events");
const ImapUser = require("../services/imapUser");
const EmailServer = require("../services/EmailServer");
const EmailAccountMiner = require("../services/EmailAccountMiner");
const redisClient = require("../../redis");
const { Worker } = require("worker_threads");
const { imapInfo } = require("../models");

function temporaryImapConnection(imapInfo, reqBody) {
  return new Imap({
    user: imapInfo.email,
    password: reqBody.password,
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
}
/**
 *  Create imap account infos
 * @param  {} req
 * @param  {} res
 */
exports.createImapInfo = (req, res) => {
  "use strict";
  if (!req.body.email || !req.body.host) {
    res.status(400).send({
      error: "Content can not be empty!",
    });
    return;
  }
  // imapInfo object
  const imapInfo = {
      email: req.body.email,
      host: req.body.host,
      port: req.body.port || 993,
      tls: req.body.tls ? req.body.tls : true,
    },
    // initiate imap client
    imap = temporaryImapConnection(imapInfo, req.body);
  // Ensures that the account exists

  imap.connect();
  // if we can connect to the imap account
  imap.once("ready", () => {
    ImapInfo.findOne({ where: { email: imapInfo.email } }).then((imapdata) => {
      if (imapdata === null) {
        // Save ImapInfo in the database
        ImapInfo.create(imapInfo)
          .then((data) => {
            res.status(200).send({ imap: data });
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

          imap,
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
exports.loginToAccount = async (req, res) => {
  "use strict";
  if (!req.body.email) {
    res.status(400).send({
      error: "Content can not be empty!",
    });
    return;
  }
  const imap = await ImapInfo.findOne({ where: { email: req.body.email } });

  if (imap == null) {
    this.createImapInfo(req, res);
  } else {
    const imapConnection = temporaryImapConnection(imap, req.body);

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
};

/**
 * Retrieve mailbox folders.
 * @param  {object} req - user request
 * @param  {object} res - http response to be sent
 */
/* A function that is called when a user wants to get his imap folders tree. */
exports.getImapBoxes = async (req, res, sse) => {
  "use strict";
  const query = JSON.parse(req.query.user);

  if (query.access_token) {
    const google_user = await googleUser.findOne({
      where: { email: query.email },
    });

    if (google_user) {
      query.refresh_token = google_user.dataValues.refreshToken;
    }
  } else {
    logger.debug(query.id, query.email);
    const imap_user = await imapInfo.findOne({ where: { id: query.id } });

    if (imap_user) {
      query.host = imap_user.host;
      query.port = imap_user.port;
    }
  }
  // define user object from user request query
  const user = new ImapUser(query).getUserConnetionDataFromQuery(),
    // initialise imap server connection
    server = new EmailServer(user, sse),
    // initialise EmailAccountMiner to mine imap tree
    miner = new EmailAccountMiner(server, user, {}, {}, "", "", ""),
    // get tree
    [tree, error] = await miner.getTree();

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
 */
exports.getEmails = async (req, res, sse) => {
  "use strict";
  if (!req.query) {
    logger.error(
      "No user query param ! request can't be handled without a user"
    );
    return res.status(404).send({
      message: "Bad request",
      error: "Bad request! check query",
    });
  }

  const query = JSON.parse(req.query.user);

  logger.debug(query.id, query.email);

  if (query.access_token) {
    const google_user = await googleUser.findOne({
      where: { email: query.email },
    });

    if (google_user) {
      query.refresh_token = google_user.dataValues.refreshToken;
    }
  } else {
    logger.debug(query.id, query.email, "getemails");

    const imap_user = await imapInfo.findOne({ where: { id: query.id } });

    if (imap_user) {
      query.host = imap_user.host;
      query.port = imap_user.port;
    }
  }
  // define user object from user request query
  const user = new ImapUser(query).getUserConnetionDataFromQuery(),
    // initialise imap server connection
    server = new EmailServer(user, sse);

  class MyEmitter extends EventEmitter {}
  const eventEmitter = new MyEmitter(),
    data = "messageWorker initiated",
    messageWorker = new Worker("./app/workers/messageWorker.js", { data }),
    // initialise EmailAccountMiner to mine imap tree
    miner = new EmailAccountMiner(
      server,
      user,
      sse,
      ["HEADER", "1"],
      req.query.boxes,
      eventEmitter,
      messageWorker
    );

  miner.mine();
  // req.on("close", async () => {
  //   console.log("**********************************End****************");
  //   // if stop mining from user then send data and end imap connetion
  //   eventEmitter.emit("endByUser", true);
  //   sse.send(true, `dns${user.id}`);
  // });
  eventEmitter.on("end", async () => {
    // get the queues length
    const QueueLengthBody = await redisClient.llen("bodies"),
      QueueLengthHeader = await redisClient.llen("headers"),
      total =
        QueueLengthBody + QueueLengthHeader == 0
          ? 100
          : (QueueLengthBody + QueueLengthHeader) * 50;
    // estimate a timeout to wait all queue jobs (150ms per command)

    setTimeout(() => {
      minedDataHelpers.getEmails(user.id).then((data) => {
        minedDataHelpers.getCountDB(user.id).then((totalScanned) => {
          // send progress to user
          sse.send(
            { totalScanned: totalScanned },

            `minedEmails${user.id}`
          );
          logger.debug(`${data.length} mined email`);
          res.status(200).send({
            message: "Done mining emails !",
            data: minedDataHelpers.sortDatabase(data)[0],
          });

          sse.send(true, `dns${user.id}`);
          logger.debug("cleaning data from database...");
        });
      });
    }, total * 20);
  });
  eventEmitter.on("error", () => {
    res.status(500).send({
      message: "Error occurend try to refresh the page or reconnect",
    });
  });

  eventEmitter.removeListener("end", () => {});
};
