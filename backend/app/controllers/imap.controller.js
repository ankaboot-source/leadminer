const logger = require('../utils/logger')(module);
const hashHelpers = require('../utils/helpers/hashHelpers');
const EventEmitter = require('node:events');
const { sse } = require('../middleware/sse');
const { db } = require('../db');
const {
  ImapConnectionProvider
} = require('../services/ImapConnectionProvider');
const { ImapBoxesFetcher } = require('../services/ImapBoxesFetcher');
const { ImapEmailsFetcher } = require('../services/ImapEmailsFetcher');
const { redis } = require('../utils/redis');
const { REDIS_MESSAGES_CHANNEL } = require('../utils/constants');

const redisStreamsPublisher = redis.getDuplicatedClient();
const redisPubSubClient = redis.getDuplicatedClient();

/**
 * The callback function that will be executed for each fetched Email.
 * @param {object} emailMessage - An email message.
 * @param {object} emailMessage.header - Email headers.
 * @param {object} emailMessage.body - Email body.
 * @param {number} emailMessage.seqNumber - Email sequence number in its folder.
 * @param {number} emailMessage.totalInFolder - Total emails in folder.
 * @param {string} emailMessage.userId - User Id.
 * @param {string} emailMessage.userEmail - User email address.
 * @param {string} emailMessage.userIdentifier - Hashed user identifier
 * @returns {Promise}
 */
async function onEmailMessage({
  body,
  header,
  folderName,
  totalInFolder,
  seqNumber,
  progress,
  userId,
  userEmail,
  userIdentifier
}) {
  sse.send(progress, `ScannedEmails${userId}`);

  const isLastInFolder = seqNumber === totalInFolder;
  // Last email in folder
  if (isLastInFolder) {
    try {
      logger.debug('Calling function populate_refined', {
        userId
      });
      await db.callRpcFunction(userId, 'populate_refined');
    } catch (error) {
      logger.error('Error from callRpcFunction(): ', error);
    }
  }

  const message = JSON.stringify({
    seqNumber,
    body,
    header,
    userId,
    userEmail,
    folderName,
    isLast: isLastInFolder,
    userIdentifier
  });

  try {
    const streamId = await redisStreamsPublisher.xadd(
      REDIS_MESSAGES_CHANNEL,
      '*',
      'message',
      message
    );
    logger.debug('Publishing message to stream', {
      streamId,
      channel: REDIS_MESSAGES_CHANNEL,
      user: userIdentifier
    });
  } catch (error) {
    logger.error('Error when publishing to streams', {
      error,
      channel: REDIS_MESSAGES_CHANNEL,
      user: userIdentifier
    });
  }
}

/**
 * Login to account
 * @param  {} req
 * @param  {} res
 */
async function loginToAccount(req, res, next) {
  const { email, host, tls, port, password } = req.body;

  if (!email || !host) {
    res.status(400);
    next(new Error('Email and host are required for IMAP.'));
  }

  performance.mark('login-start');

  const imapConnection = new ImapConnectionProvider(email)
    .withPassword(password, host)
    .getImapConnection();

  imapConnection.once('error', (err) => {
    err.message = `Can't connect to imap account with email ${email} and host ${host}.`;
    next(err);
  });

  const imapUser = await db.getImapUserByEmail(email);
  if (imapUser === null) {
    imapConnection.once('ready', async () => {
      try {
        const imapData = await db.getImapUserByEmail(email);
        if (imapData !== null) {
          res.status(200).send({
            message: 'Your account already exists !',
            imapConnection
          });
        }

        const data = await db.createImapUser({ email, host, port, tls });
        res.status(200).send({ imap: data });
      } catch (error) {
        next(error);
      } finally {
        imapConnection.end();
      }
    });
  } else {
    imapConnection.once('ready', () => {
      res.status(200).send({
        imap: imapUser
      });
      imapConnection.end();

      logger.info('Account successfully logged in.', {
        email,
        duration: performance.measure('measure login', 'login-start').duration
      });
    });
  }

  imapConnection.connect();
}

/**
 * Retrieve mailbox folders.
 * @param {object} req - user request
 * @param {object} res - http response to be sent
 */
async function getImapBoxes(req, res, next) {
  if (!req.headers['x-imap-login']) {
    res.status(400);
    next(new Error('An x-imap-login header field is required.'));
  }

  const { access_token, id, email, password } = JSON.parse(
    req.headers['x-imap-login']
  );

  let imapConnectionProvider = new ImapConnectionProvider(email);

  if (access_token) {
    const { refresh_token } = await db.getGoogleUserByEmail(email);
    imapConnectionProvider = await imapConnectionProvider.withGoogle(
      access_token,
      refresh_token,
      sse,
      id
    );
  } else {
    const { host, port } = await db.getImapUserById(id);
    imapConnectionProvider = imapConnectionProvider.withPassword(
      password,
      host,
      port
    );
  }

  try {
    const imapBoxesFetcher = new ImapBoxesFetcher(imapConnectionProvider);
    const tree = await imapBoxesFetcher.getTree();

    logger.info('Mining IMAP tree succeeded.', {
      user: hashHelpers.hashEmail(email, id)
    });

    return res.status(200).send({
      message: 'IMAP folders fetched successfully!',
      imapFoldersTree: tree
    });
  } catch (error) {
    error.message = 'Unable to fetch IMAP folders.';
    error.user = hashHelpers.hashEmail(email, id);
    return next(error);
  }
}

/**
 * Get Emails from imap server.
 * @param {object} req - user request
 * @param {object} res - http response to be sent
 */
async function getEmails(req, res, next) {
  if (!req.headers['x-imap-login']) {
    res.status(400);
    next(new Error('An x-imap-login header field is required.'));
  }

  const { access_token, id, email, password } = JSON.parse(
    req.headers['x-imap-login']
  );

  let imapConnectionProvider = new ImapConnectionProvider(email);

  if (access_token) {
    const { refresh_token } = await db.getGoogleUserByEmail(email);
    imapConnectionProvider = await imapConnectionProvider.withGoogle(
      access_token,
      refresh_token,
      sse,
      id
    );
  } else {
    const { host, port } = await db.getImapUserById(id);
    imapConnectionProvider = imapConnectionProvider.withPassword(
      password,
      host,
      port
    );
  }

  const eventEmitter = new EventEmitter();

  req.on('close', () => {
    eventEmitter.emit('endByUser');
  });

  eventEmitter.on('error', () => {
    res.status(500).send({
      message: 'An error has occurred while trying to fetch emails.'
    });
  });

  eventEmitter.on('end', () => {
    res.status(200).send();
  });

  const { boxes } = req.query;
  const imapEmailsFetcher = new ImapEmailsFetcher(
    imapConnectionProvider,
    eventEmitter,
    boxes,
    id,
    email
  );

  let extractedEmailMessages = 0;

  // This channel will be used to track extracting progress
  redisPubSubClient.subscribe(id, (err) => {
    if (err) {
      logger.error('Failed subscribing to Redis.');
    }
  });

  redisPubSubClient.on('message', () => {
    extractedEmailMessages++;
    sse.send(extractedEmailMessages, `ExtractedEmails${id}`);
  });

  await imapEmailsFetcher.fetchEmailMessages(onEmailMessage);
  sse.send(true, 'data');
  sse.send(true, `dns${id}`);
  eventEmitter.emit('end', true);
}

module.exports = {
  getEmails,
  getImapBoxes,
  loginToAccount
};
