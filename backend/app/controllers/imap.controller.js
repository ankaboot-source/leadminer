const Imap = require('imap');
const db = require('../models'),
  ImapInfo = db.imapInfo,
  googleUser = db.googleUsers,
  logger = require('../utils/logger')(module);
const hashHelpers = require('../utils/helpers/hashHelpers');
const EventEmitter = require('node:events');
const ImapUser = require('../services/imapUser');
const EmailServer = require('../services/EmailServer');
const EmailAccountMiner = require('../services/EmailAccountMiner');
const { imapInfo } = require('../models');
const { sse } = require('../middleware/sse');

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
exports.createImapInfo = (req, res, next) => {
  const { email, host, tls, port } = req.body;

  if (!email || !host) {
    res.status(400);
    next(new Error('Email and host are required for IMAP.'));
  }

  // imapInfo object
  const imapInfo = {
    email,
    host,
    port: port || 993,
    tls: tls ? tls : true
  };

  // initiate imap client
  const imap = temporaryImapConnection(imapInfo, req.body);
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
            err.message = 'Failed to create IMAP user.';
            next(err);
          });
      } else {
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
    err.message = `Can't connect to imap account with email ${email} and host ${host}.`;
    next(err);
  });
};
/**
 * Login to account
 * @param  {} req
 * @param  {} res
 */
exports.loginToAccount = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    next(new Error('Email is required to login'));
  }

  const imap = await ImapInfo.findOne({ where: { email } });
  if (imap === null) {
    this.createImapInfo(req, res);
  } else {
    const imapConnection = temporaryImapConnection(imap, req.body);

    imapConnection.connect();
    imapConnection.once('ready', () => {
      if (imap) {
        logger.info('Account succesfully logged in.', {
          email
        });
        res.status(200).send({
          imap
        });
        imapConnection.end();
      }
    });
    imapConnection.on('error', (err) => {
      err.message = 'Unable to connect to IMAP account.';
      next(err);
    });
  }
};

/**
 * Retrieve mailbox folders.
 * @param  {object} req - user request
 * @param  {object} res - http response to be sent
 */
/* A function that is called when a user wants to get his imap folders tree. */
exports.getImapBoxes = async (req, res, next) => {
  if (!req.headers['x-imap-login']) {
    res.status(400);
    next(new Error('An x-imap-login header field is required.'));
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
    const imap_user = await imapInfo.findOne({ where: { id: query.id } });

    if (imap_user) {
      query.host = imap_user.host;
      query.port = imap_user.port;
    }
  }
  // define user object from user request query
  const user = new ImapUser(query).getUserConnectionDataFromQuery();
  // initialise imap server connection
  const server = new EmailServer(user, sse);
  // initialise EmailAccountMiner to mine imap tree
  const miner = new EmailAccountMiner(server, user, {}, {}, '', '', '');
  // get tree
  const [tree, error] = await miner.getTree();

  if (error) {
    error.message = 'Unable to fetch IMAP folders.';
    error.emailHash = hashHelpers.hashEmail(user.email);
    next(error);
  }
  if (tree.length > 0) {
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
 */
exports.getEmails = async (req, res, next) => {
  if (!req.headers['x-imap-login']) {
    if (!req.headers['x-imap-login']) {
      res.status(400);
      next(new Error('An x-imap-login header field is required.'));
    }
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
    logger.debug(query.id, query.email, 'getemails');

    const imap_user = await imapInfo.findOne({ where: { id: query.id } });

    if (imap_user) {
      query.host = imap_user.host;
      query.port = imap_user.port;
    }
  }
  // define user object from user request query
  const user = new ImapUser(query).getUserConnectionDataFromQuery(),
    // initialise imap server connection
    server = new EmailServer(user, sse);
  // defines events, and workers
  class MyEmitter extends EventEmitter {}
  const eventEmitter = new MyEmitter();

  // initialise EmailAccountMiner to mine imap folder
  const miner = new EmailAccountMiner(
    server,
    user,
    sse,
    ['HEADER', '1'],
    req.query.boxes,
    eventEmitter
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
