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
const { REDIS_STREAM_NAME } = require('../utils/constants');
const { getXImapHeaderField, IMAP_ERROR_CODES } = require('./helpers');

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

  const { heapTotal, heapUsed } = process.memoryUsage();
  logger.debug(
    `[MAIN PROCESS] Heap total: ${(heapTotal / 1024 / 1024 / 1024).toFixed(
      2
    )} | Heap used: ${(heapUsed / 1024 / 1024 / 1024).toFixed(2)} `
  );

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
      REDIS_STREAM_NAME,
      '*',
      'message',
      message
    );
    logger.debug('Publishing message to stream', {
      streamId,
      channel: REDIS_STREAM_NAME,
      user: userIdentifier
    });
  } catch (error) {
    logger.error('Error when publishing to streams', {
      error,
      channel: REDIS_STREAM_NAME,
      user: userIdentifier
    });
  }
}

/**
 * Login to account
 * @param  {} req
 * @param  {} res
 */
function loginToAccount(req, res, next) {
  const { email, host, tls, port, password } = req.body;

  if (!email || !host) {
    res.status(400);
    next(new Error('Email and host are required for IMAP.'));
  }

  performance.mark('imap-login-start');

  const imapConnection = new ImapConnectionProvider(email)
    .withPassword(host, password, port)
    .getImapConnection();

  imapConnection.once('error', (err) => {
    const genericErrorMessage = {
      message: 'Something went wrong on our end. Please try again later.',
      code: 500
    };
    const { code, message } =
      IMAP_ERROR_CODES[err.textCode ?? err.code] ?? genericErrorMessage;

    err.message = message;
    res.status(code);
    next(err);
  });

  imapConnection.once('ready', async () => {
    try {
      const imapUser =
        (await db.getImapUserByEmail(email)) ??
        (await db.createImapUser({ email, host, port, tls }));

      if (!imapUser) {
        throw Error('Error when creating or quering imapUser');
      }

      logger.info('Account successfully logged in.', { email });

      imapConnection.end();
      imapConnection.removeAllListeners();
      res.status(200).send({ imap: imapUser });
    } catch (error) {
      imapConnection.end();
      imapConnection.removeAllListeners();
      next({ message: 'Failed to login using Imap', details: error.message });
    }
  });
  imapConnection.connect();
}

/**
 * Retrieve mailbox folders.
 * @param {object} req - user request
 * @param {object} res - http response to be sent
 */
async function getImapBoxes(req, res, next) {
  const { data, error } = getXImapHeaderField(req.headers);

  if (error) {
    res.status(400);
    return next(error);
  }

  const { access_token, id, email, password } = data;
  const userResult = access_token
    ? await db.getGoogleUserByEmail(email)
    : await db.getImapUserById(id);

  if (userResult === null) {
    res.status(400);
    return next(new Error('user does not exists.'));
  }

  const { host, port, refresh_token } = userResult;

  let imapConnectionProvider = new ImapConnectionProvider(email);

  imapConnectionProvider = access_token
    ? await imapConnectionProvider.withGoogle(
        access_token,
        refresh_token,
        id,
        sse
      )
    : imapConnectionProvider.withPassword(host, password, port);

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
  } catch (err) {
    err.message = 'Unable to fetch IMAP folders.';
    err.user = hashHelpers.hashEmail(email, id);
    return next(err);
  }
}

/**
 * Get Emails from imap server.
 * @param {Object} req - The user request.
 * @param {Object} res - The http response to be sent.
 * @param {function} next - The next middleware function in the route.
 */
async function getEmails(req, res, next) {
  const { data, error } = getXImapHeaderField(req.headers);

  if (error) {
    res.status(400);
    return next(error);
  }

  const { access_token, id, email, password } = data;
  const userResult = access_token
    ? await db.getGoogleUserByEmail(email)
    : await db.getImapUserById(id);

  if (userResult === null) {
    res.status(400);
    return next(new Error('user does not exists.'));
  }

  const { host, port, refresh_token } = userResult;

  let imapConnectionProvider = new ImapConnectionProvider(email);

  imapConnectionProvider = access_token
    ? await imapConnectionProvider.withGoogle(
        access_token,
        refresh_token,
        id,
        sse
      )
    : imapConnectionProvider.withPassword(host, password, port);

  const eventEmitter = new EventEmitter();

  req.on('close', () => {
    eventEmitter.emit('endByUser');
  });

  eventEmitter.on('error', () => {
    eventEmitter.removeAllListeners();
    res.status(500).send({
      message: 'An error has occurred while trying to fetch emails.'
    });
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
  eventEmitter.removeAllListeners();
  return res.status(200).send();
}

module.exports = {
  getEmails,
  getImapBoxes,
  loginToAccount
};
