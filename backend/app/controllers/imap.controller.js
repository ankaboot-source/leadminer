const Imap = require('imap');
const db = require('../models'),
  ImapInfo = db.imapInfo,
  googleUser = db.googleUsers,
  logger = require('../utils/logger')(module);
const hashHelpers = require('../utils/hashHelpers');
const EventEmitter = require('node:events');
const ImapUser = require('../services/imapUser');
const EmailServer = require('../services/EmailServer');
const EmailAccountMiner = require('../services/EmailAccountMiner');
const { Worker } = require('worker_threads');
const { imapInfo } = require('../models');

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
      servername: imapInfo.host
    }
  });
}
/**
 *  Create imap account infos
 * @param  {} req
 * @param  {} res
 */
exports.createImapInfo = (req, res) => {
  'use strict';
  if (!req.body.email || !req.body.host) {
    res.status(400).send({
      error: 'Content can not be empty!'
    });
    return;
  }
  // imapInfo object
  const imapInfo = {
      email: req.body.email,
      host: req.body.host,
      port: req.body.port || 993,
      tls: req.body.tls ? req.body.tls : true
    },
    // initiate imap client
    imap = temporaryImapConnection(imapInfo, req.body);
  // Ensures that the account exists

  imap.connect();
  // if we can connect to the imap account
  imap.once('ready', () => {
    ImapInfo.findOne({ where: { email: imapInfo.email } }).then((imapdata) => {
      if (imapdata === null) {
        // Save ImapInfo in the database
        ImapInfo.create(imapInfo)
          .then((data) => {
            res.status(200).send({ imap: data });
          })
          .catch((err) => {
            logger.error('Unable to create account with this email.', {
              error: err,
              email: req.body.email
            });
            res.status(500).send({
              error:
                'Some error occurred while creating your account imap info.'
            });
          });
      } else {
        logger.info('On signup : An account with this email already exists.', {
          email: req.body.email
        });
        res.status(200).send({
          message: 'Your account already exists !',
          imap
        });
      }
      imap.end();
    });
  });
  // The imap account does not exists or connexion denied
  imap.once('error', (err) => {
    logger.error('Unable to connect to imap account with this email and host', {
      error: err,
      email: req.body.email,
      host: req.body.host
    });
    res.status(500).send({
      error: `Can't connect to imap account with email ${req.body.email} and host ${req.body.host} : **Error** ${err}`
    });
  });
};
/**
 * Login to account
 * @param  {} req
 * @param  {} res
 */
exports.loginToAccount = async (req, res) => {
  'use strict';
  if (!req.body.email) {
    res.status(400).send({
      error: 'Content can not be empty!'
    });
    return;
  }
  const imap = await ImapInfo.findOne({ where: { email: req.body.email } });
  if (imap === null) {
    this.createImapInfo(req, res);
  } else {
    const imapConnection = temporaryImapConnection(imap, req.body);

    imapConnection.connect();
    imapConnection.once('ready', () => {
      if (imap) {
        logger.info('Account succesfully logged in.', {
          email: req.body.email
        });
        res.status(200).send({
          imap
        });
        imapConnection.end();
      }
    });
    imapConnection.on('error', (err) => {
      logger.error('Unable to connect to imap account.', {
        error: err,
        email: req.body.email,
        host: req.body.host
      });
      res.status(500).send({
        error: `Can't connect to imap account with email ${req.body.email} and host ${req.body.host} : **Error** ${err}`
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
  ('use strict');
  if (!req.headers['x-imap-login']) {
    logger.error('No user login! Unable to handle request without a login');
    return res.status(404).send({
      message: 'Bad request',
      error: 'Bad request! please check login!'
    });
  }

  const query = JSON.parse(req.headers['x-imap-login']);

  if (query.access_token) {
    const google_user = await googleUser.findOne({
      where: { email: query.email }
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
    miner = new EmailAccountMiner(server, user, {}, {}, '', '', ''),
    // get tree
    [tree, error] = await miner.getTree();

  if (error) {
    logger.error('Mining IMAP tree failed.', {
      error,
      emailHash: hashHelpers.hashEmail(user.email)
    });
    res.status(400).send({
      message: 'Unable to fetch IMAP folders.',
      error
    });
  }
  if (tree) {
    logger.info('Mining IMAP tree succeeded.', {
      emailHash: hashHelpers.hashEmail(user.email)
    });
    res.status(200).send({
      message: 'IMAP folders fetched successfully!',
      imapFoldersTree: tree
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
  'use strict';
  if (!req.headers['x-imap-login']) {
    logger.error('No user login! Unable to handle request without a user');
    return res.status(404).send({
      message: 'Bad request',
      error: 'Bad request! please check login!'
    });
  }

  const query = JSON.parse(req.headers['x-imap-login']);

  logger.debug(query.id, query.email);

  if (query.access_token) {
    const google_user = await googleUser.findOne({
      where: { email: query.email }
    });

    if (google_user) {
      query.refresh_token = google_user.dataValues.refreshToken;
    }
  } else {
    logger.debug(query.id, query.email, 'getemails');

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
  // defines events, and workers
  class MyEmitter extends EventEmitter {}
  const eventEmitter = new MyEmitter(),
    data = 'messageWorker initiated',
    messageWorker = new Worker('./app/workers/messageWorker.js', { data });

  // initialise EmailAccountMiner to mine imap folder
  const miner = new EmailAccountMiner(
    server,
    user,
    sse,
    ['HEADER', '1'],
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

  eventEmitter.on('error', () => {
    res.status(500).send({
      message: 'Error occurend try to refresh the page or reconnect'
    });
  });

  eventEmitter.removeListener('end', () => {});
};
