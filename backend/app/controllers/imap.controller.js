const { logger } = require('../utils/logger');
const { db } = require('../db');
const {
  ImapConnectionProvider
} = require('../services/ImapConnectionProvider');
const { ImapBoxesFetcher } = require('../services/ImapBoxesFetcher');
const { ImapEmailsFetcher } = require('../services/ImapEmailsFetcher');
const { miningTaskManagerInstance } = require('../services/TaskManager');


const hashHelpers = require('../utils/helpers/hashHelpers');
const { getXImapHeaderField, IMAP_ERROR_CODES } = require('./helpers');

const { redis } = require('../utils/redis');
const { REDIS_STREAM_NAME } = require('../utils/constants');
const redisStreamsPublisher = redis.getDuplicatedClient();
const redisPublisher = redis.getDuplicatedClient();

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
  userId,
  userEmail,
  userIdentifier,
  miningID
}) {
  const isLastInFolder = seqNumber === totalInFolder;

  const message = JSON.stringify({
    seqNumber,
    body,
    header,
    userId,
    userEmail,
    folderName,
    isLast: isLastInFolder,
    userIdentifier,
    miningID
  });

  try {

    const fetchingProgress = {
      miningID,
      progressType: 'fetching'
    };

    await redisPublisher.publish(miningID, JSON.stringify(fetchingProgress));
    await redisStreamsPublisher.xadd(
      REDIS_STREAM_NAME,
      '*',
      'message',
      message
    );
  } catch (error) {
    logger.error('Error when publishing to streams', {
      metadata: {
        error,
        channel: REDIS_STREAM_NAME,
        user: userIdentifier
      }
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

  const imapConnectionProvider = new ImapConnectionProvider(email).withPassword(
    host,
    password,
    port
  );

  const imapConnection = await imapConnectionProvider.acquireConnection();

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

  try {
    const imapUser =
      (await db.getImapUserByEmail(email)) ??
      (await db.createImapUser({ email, host, port, tls }));

    if (!imapUser) {
      throw Error('Error when creating or quering imapUser');
    }

    logger.info('Account successfully logged in.', { metadata: { email } });

    res.status(200).send({ imap: imapUser });
  } catch (error) {
    next({
      message: 'Failed to login using Imap',
      details: error.message
    });
  } finally {
    await imapConnectionProvider.releaseConnection(imapConnection);
    await imapConnectionProvider.cleanPool();
  }
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

  try {
    if (access_token) {
      imapConnectionProvider = await imapConnectionProvider.withGoogle(
        access_token,
        refresh_token,
        id,
        redisPublisher
      );
    } else {
      imapConnectionProvider = imapConnectionProvider.withPassword(
        host,
        password,
        port
      );
    }

    const imapBoxesFetcher = new ImapBoxesFetcher(imapConnectionProvider);
    const tree = await imapBoxesFetcher.getTree();

    logger.info('Mining IMAP tree succeeded.', {
      metadata: {
        user: hashHelpers.hashEmail(email, id)
      }
    });

    return res.status(200).send({
      message: 'IMAP folders fetched successfully!',
      imapFoldersTree: tree
    });
  } catch (err) {
    err.description = err.message;
    err.message = 'Unable to fetch IMAP folders.';
    err.user = hashHelpers.hashEmail(email, id);
    return next(err);
  } finally {
    await imapConnectionProvider.cleanPool();
  }
}

/**
 * Get Emails from imap server.
 * @param {Object} req - The user request.
 * @param {Object} res - The http response to be sent.
 * @param {function} next - The next middleware function in the route.
 */
async function startMining(req, res, next) {
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
      redisPublisher
    )
    : imapConnectionProvider.withPassword(host, password, port);

  const { boxes } = req.body;
  const miningID = miningTaskManagerInstance.generateMiningID(id);

  const imapEmailsFetcher = new ImapEmailsFetcher(
    imapConnectionProvider,
    boxes,
    id,
    email,
    miningID
  );

  const miningTask = miningTaskManagerInstance.createTask(miningID, id, imapEmailsFetcher);
  imapEmailsFetcher.fetchEmailMessages(onEmailMessage);

  const { heapTotal, heapUsed } = process.memoryUsage();
  logger.debug(
    `[MAIN PROCESS] Heap total: ${(heapTotal / 1024 / 1024 / 1024).toFixed(
      2
    )} | Heap used: ${(heapUsed / 1024 / 1024 / 1024).toFixed(2)} `
  );

  return res.status(201).send({
    error: null,
    data: miningTask
  });
}

/**
 * Stop mining task, using MiningID.
 * @param {Object} req - The user request.
 * @param {Object} res - The http response to be sent.
 * @param {function} next - The next middleware function in the route.
 */
async function stopMining(req, res, next) {

  const { error } = getXImapHeaderField(req.headers);

  if (error) {
    res.status(400);
    return next(error);
  }

  const { id } = req.params;

  const task = miningTaskManagerInstance.stopMining(id);

  return res.status(200).send({ error: null, data: task || null });
}

module.exports = {
  getImapBoxes,
  loginToAccount,
  startMining,
  stopMining
};
