/* istanbul ignore file */
const Imap = require('imap');
const db = require('../models');
const ImapInfo = db.imapInfo;
const googleUser = db.googleUsers;
const logger = require('../utils/logger')(module);
const hashHelpers = require('../utils/hashHelpers');
const databaseHelpers = require('../utils/databaseHelpers');
const inputHelpers = require('../utils/inputHelpers');
const EventEmitter = require('node:events');
const ImapUser = require('../services/imapUser');
const EmailServer = require('../services/EmailServer');
const EmailAccountMiner = require('../services/EmailAccountMiner');
const redisClient = require('../../redis');

const { imapInfo } = require('../models');
/**
 *  Create imap account infos
 * @param  {} req
 * @param  {} res
 */
exports.createImapInfo = (req, res) => {
  if (!req.body.email || !req.body.host || !req.body.port) {
    res.status(400).send({
      error: 'Content can not be empty!',
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
  imap.once('ready', () => {
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
                'Some error occurred while creating your account imap info.',
            });
          });
      } else {
        logger.info(
          `On signup : Account with email ${req.body.email} already exist`
        );
        res.status(200).send({
          message: 'Your account already exists !',
          switch: true,
          imapdata,
        });
      }
      imap.end();
    });
  });
  // The imap account does not exists or connexion denied
  imap.once('error', (err) => {
    logger.error(
      `Can't connect to imap account with email ${req.body.email} and host ${req.body.host}  : **Error** ${err}`
    );
    res.status(500).send({
      error: 'We can\'t connect to your imap account.',
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
      error: 'Content can not be empty!',
    });
    return;
  }
  ImapInfo.findOne({ where: { email: req.body.email } }).then((imap) => {
    if (imap === null) {
      logger.error(
        `On login : Account with email ${req.body.email} does not exist`
      );

      this.createImapInfo(req, res);
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
      imapConnection.once('ready', () => {
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
      imapConnection.on('error', (err) => {
        logger.error(
          `Can't connect to imap account with email ${req.body.email} and host ${req.body.host} : **Error** ${err}`
        );
        res.status(500).send({
          error: 'We can\'t connect to your imap account, Check credentials.',
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
/* A function that is called when a user wants to get his imap folders tree. */
exports.getImapBoxes = async (req, res, sse) => {
  const query = JSON.parse(req.query.user);
  if (query.access_token) {
    const google_user = await googleUser.findOne({
      where: { email: query.email },
    });
    if (google_user) {
      query['refresh_token'] = google_user.dataValues.refreshToken;
    }
  } else {
    const imap_user = await imapInfo.findOne({ where: { id: query.id } });
    if (imap_user) {
      query['host'] = imap_user.host;
      query['port'] = imap_user.port;
    }
  }
  // define user object from user request query
  const user = new ImapUser(query).getUserConnetionDataFromQuery();
  // initialise imap server connection
  const server = new EmailServer(user, sse);
  // initialise EmailAccountMiner to mine imap tree
  const miner = new EmailAccountMiner(server, user, {}, {}, '', '', '');
  // get tree
  const [tree, error] = await miner.getTree();
  if (error) {
    logger.error(
      `Mining imap tree failed for user with email ${hashHelpers.hashEmail(
        user.email
      )} reason : ${error}`
    );
    res.status(400).send({
      message: 'Can\'t fetch imap folders',
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
      message: 'Imap folders fetched with success !',
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
  if (!req.query) {
    logger.error(
      'No user query param ! request can\'t be handled without a user'
    );
    return res.status(404).send({
      message: 'Bad request',
      error: 'Bad request! check query',
    });
  }

  const query = JSON.parse(req.query.user);
  if (query.access_token) {
    const google_user = await googleUser.findOne({
      where: { email: query.email },
    });
    if (google_user) {
      query['refresh_token'] = google_user.dataValues.refreshToken;
    }
  } else {
    const imap_user = await imapInfo.findOne({ where: { id: query.id } });
    if (imap_user) {
      query['host'] = imap_user.host;
      query['port'] = imap_user.port;
    }
  }
  // define user object from user request query
  const user = new ImapUser(query).getUserConnetionDataFromQuery();
  // initialise imap server connection
  const server = new EmailServer(user, sse);

  class MyEmitter extends EventEmitter {}
  const eventEmitter = new MyEmitter();
  // initialise EmailAccountMiner to mine imap tree
  const miner = new EmailAccountMiner(
    server,
    user,
    sse,
    ['HEADER', '1'],
    req.query.boxes,
    eventEmitter
  );
  miner.mine();
  req.on('close', async () => {
    // if stop mining from user then send data and end imap connetion
    eventEmitter.emit('endByUser', true);
    sse.send(true, `dns${user.id}`);
  });
  eventEmitter.on('end', async () => {
    //get the queues length
    const QueueLengthBody = await redisClient.lLen('bodies');
    const QueueLengthHeader = await redisClient.lLen('headers');
    const total =
      QueueLengthBody + QueueLengthHeader == 0 ? 100 : (QueueLengthBody + QueueLengthHeader) * 50;
    //estimate a timeout to wait all queue jobs (150ms per command)

    setTimeout(() => {
      databaseHelpers.getEmails(user.id).then((data) => {
        databaseHelpers.getCountDB(user.id).then((totalScanned) => {
          // send progress to user
          sse.send(
            { totalScanned: totalScanned },

            `minedEmails${user.id}`
          );

          logger.debug(`${data.length} mined email`);
          res.status(200).send({
            message: 'Done mining emails !',
            data: inputHelpers.sortDatabase(data),
          });

          sse.send(true, `dns${user.id}`);
          logger.debug('cleaning data from database...');
          databaseHelpers.deleteUserData(user.id).then(() => {
            logger.debug('database cleaned ✔️');
          });
          logger.debug('cleaning data from redis...');

          redisClient.flushAll('ASYNC').then((res) => {
            if (res === 'OK') {
              logger.debug('redis cleaned ✔️');
            } else logger.debug('can\'t clean redis');
          });
        });
      });
    }, total * 20);
  });
  eventEmitter.on('error', () => {
    res.status(500).send({
      message: 'Error occurend try to refresh the page or reconnect',
    });
  });
  eventEmitter.removeListener('end', () => {});
};
