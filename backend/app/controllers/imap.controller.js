const { logger } = require('../utils/logger');
const { db } = require('../db');
const {
  ImapConnectionProvider
} = require('../services/ImapConnectionProvider');
const { ImapBoxesFetcher } = require('../services/ImapBoxesFetcher');
const { ImapEmailsFetcher } = require('../services/ImapEmailsFetcher');
const { miningTasksManager } = require('../services/TasksManager');
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
 * @param {string} emailMessage.miningId - Id of the mining process.
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
  miningId
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
    miningId
  });

  try {
    const fetchingProgress = {
      miningId,
      progressType: 'fetched'
    };

    await redisPublisher.publish(miningId, JSON.stringify(fetchingProgress));
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
 * Get a user by either their access token and email or their IMAP ID or email.
 * 
 * @param {Object} params - An object containing the necessary parameters to fetch a user.
 * @param {string} params.access_token - The user's Google access token.
 * @param {string} params.id - The user's IMAP ID.
 * @param {string} params.email - The user's email address.
 * @returns {Promise<Object>} - A promise that resolves with the user object, or null if not found.
 * @throws {Error} - If at least one parameter is not provided.
 * 
 * @example
 * const params = { id: '123', email: 'user@example.com' };
 * const user = await getUser(params);
 * console.log(user);
 */
function getUser({ access_token, id, email }) {

  if (!access_token && !id && !email) {
    throw new Error('At least one parameter is required { access_token, id, email }.');
  }

  if (access_token) {
    return db.getGoogleUserByEmail(email);
  } else if (id) {
    return db.getImapUserById(id);
  }

  return db.getImapUserByEmail(email);
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
    const user =
      (await getUser({ email })) ??
      (await db.createImapUser({ email, host, port, tls }));

    if (!user) {
      throw Error('Error when creating or quering user');
    }

    logger.info('Account successfully logged in.', { metadata: { email } });

    res.status(200).send({ imap: user });
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
  const user = await getUser(data);

  if (user === null) {
    res.status(400);
    return next(new Error('user does not exists.'));
  }

  const { host, port, refresh_token } = user;

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
  const { boxes } = req.body;

  if (error || boxes === undefined) {
    res.status(400);
    return next(error || new Error('Missing parameter boxes'));
  }

  const { access_token, id, email, password } = data;
  const user = await getUser(data);

  if (user === null) {
    res.status(400);
    return next(new Error('user does not exists.'));
  }

  let miningTask = null;

  try {
    const { host, port, refresh_token } = user;
    const imapConnectionProvider = access_token
      ? await (new ImapConnectionProvider(email)).withGoogle(
        access_token,
        refresh_token,
        id,
        redisPublisher
      )
      : (new ImapConnectionProvider(email)).withPassword(
        host,
        password,
        port
      );
    const miningId = await miningTasksManager.generateMiningId();
    const imapEmailsFetcher = new ImapEmailsFetcher(
      imapConnectionProvider,
      boxes,
      id,
      email,
      miningId
    );

    miningTask = await miningTasksManager.createTask(miningId, id, imapEmailsFetcher);

    imapEmailsFetcher.fetchEmailMessages(onEmailMessage);

    const { heapTotal, heapUsed } = process.memoryUsage();
    logger.debug(
      `[MAIN PROCESS] Heap total: ${(heapTotal / 1024 / 1024 / 1024).toFixed(
        2
      )} | Heap used: ${(heapUsed / 1024 / 1024 / 1024).toFixed(2)} `
    );

  } catch (err) {
    res.status(500);
    return next(err);
  }

  return res.status(201).send({ error: null, data: miningTask });
}

/**
 * Retrieves the active mining task with the specified ID.
 * @param {Object} req - The user request.
 * @param {Object} res - The http response to be sent.
 * @param {function} next - The next middleware function in the route.
 */
async function getMiningTask(req, res, next) {
  const { error } = getXImapHeaderField(req.headers);

  if (error) {
    res.status(400);
    return next(error);
  }

  const { id } = req.params;

  try {
    const task = await miningTasksManager.getActiveTask(id);
    return res.status(200).send({ data: task });
  } catch (err) {
    res.status(404);
    return next(err);
  }
}

/**
 * Stop mining task, using MiningID.
 * @param {Object} req - The user request.
 * @param {Object} res - The http response to be sent.
 * @param {function} next - The next middleware function in the route.
 */
async function stopMiningTask(req, res, next) {
  const { error } = getXImapHeaderField(req.headers);

  if (error) {
    res.status(400);
    return next(error);
  }

  const { id } = req.params;

  try {
    const task = await miningTasksManager.deleteTask(id);
    return res.status(200).send({ data: task });
  } catch (err) {
    res.status(404);
    return next(err);
  }
}

module.exports = {
  getImapBoxes,
  loginToAccount,
  startMining,
  stopMiningTask,
  getMiningTask
};
