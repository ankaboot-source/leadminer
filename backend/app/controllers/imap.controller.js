const { logger } = require('../utils/logger');
const { db } = require('../db');
const {
  ImapConnectionProvider
} = require('../services/ImapConnectionProvider');
const { ImapBoxesFetcher } = require('../services/ImapBoxesFetcher');
const { miningTasksManager } = require('../services/TasksManager');
const hashHelpers = require('../utils/helpers/hashHelpers');
const { getUser, getXImapHeaderField, IMAP_ERROR_CODES } = require('./helpers');
const { redis } = require('../utils/redis');
const { LEADMINER_FETCH_BATCH_SIZE } = require('../config');
const redisPublisher = redis.getDuplicatedClient();

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
      (await getUser({ email }, db)) ??
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
  const user = await getUser(data, db);

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
  const user = await getUser(data, db);

  if (user === null) {
    res.status(400);
    return next(new Error('user does not exists.'));
  }

  let miningTask = null;

  try {
    const { host, port, refresh_token } = user;
    const imapConnectionProvider = access_token
      ? await new ImapConnectionProvider(email).withGoogle(
          access_token,
          refresh_token,
          id,
          redisPublisher
        )
      : new ImapConnectionProvider(email).withPassword(host, password, port);

    const batchSize = LEADMINER_FETCH_BATCH_SIZE;
    const imapEmailsFetcherOptions = {
      imapConnectionProvider,
      boxes,
      id,
      email,
      batchSize
    };

    miningTask = await miningTasksManager.createTask(
      id,
      imapEmailsFetcherOptions
    );

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
