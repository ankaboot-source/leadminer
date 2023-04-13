const { logger } = require('../utils/logger');
const { db } = require('../db');
const {
  ImapConnectionProvider
} = require('../services/ImapConnectionProvider');
const { ImapBoxesFetcher } = require('../services/ImapBoxesFetcher');
const { miningTasksManager } = require('../services/TasksManager');
const hashHelpers = require('../utils/helpers/hashHelpers');
const {
  getUser,
  getXImapHeaderField,
  generateErrorObjectFromImapError,
  getImapParametersFromBody
} = require('./helpers');
const { redis } = require('../utils/redis');
const { LEADMINER_FETCH_BATCH_SIZE } = require('../config');
const redisClient = redis.getClient();

/**
 * Logs into an IMAP account.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {Promise<void>}
 */
async function loginToAccount(req, res, next) {
  let imapConnectionProvider = null;
  let imapConnection = null;
  let user = null;

  try {
    const { email, host, tls, port, password } = getImapParametersFromBody(
      req.body
    );

    imapConnectionProvider = new ImapConnectionProvider(email).withPassword(
      host,
      password,
      parseInt(port)
    );
    imapConnection = await imapConnectionProvider.acquireConnection();

    user =
      (await getUser({ email }, db)) ??
      (await db.createImapUser({ email, host, port, tls }));

    if (!user) {
      const genericErrorResponse = {
        message: 'Something went wrong on our end. Please try again later.',
        code: 500
      };
      throw new Error(genericErrorResponse);
    }
    logger.info('IMAP login successful', { metadata: { email } });
  } catch (error) {
    const newError = generateErrorObjectFromImapError(error);
    res.status(newError.code);
    return next(new Error(newError.message));
  } finally {
    await imapConnectionProvider?.releaseConnection(imapConnection);
    await imapConnectionProvider?.cleanPool();
  }

  return res.status(200).send({ imap: user });
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
  const imapConnectionProvider = access_token
    ? await new ImapConnectionProvider(email).withGoogle(
        access_token,
        refresh_token,
        id,
        redisClient
      )
    : new ImapConnectionProvider(email).withPassword(host, password, port);
  let imapConnection = null;
  let tree = null;

  try {
    imapConnection = await imapConnectionProvider.acquireConnection();
    const imapBoxesFetcher = new ImapBoxesFetcher(imapConnectionProvider);
    tree = await imapBoxesFetcher.getTree();

    logger.info('Mining IMAP tree succeeded.', {
      metadata: {
        user: hashHelpers.hashEmail(email, id)
      }
    });
  } catch (err) {
    const newError = generateErrorObjectFromImapError(err);

    res.status(newError.code);
    return next(new Error(newError.message));
  } finally {
    await imapConnectionProvider.releaseConnection(imapConnection);
    await imapConnectionProvider.cleanPool();
  }

  return res.status(200).send({
    message: 'IMAP folders fetched successfully!',
    imapFoldersTree: tree
  });
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

  const { host, port, refresh_token } = user;

  const imapConnectionProvider = access_token
    ? await new ImapConnectionProvider(email).withGoogle(
        access_token,
        refresh_token,
        id,
        redisClient
      )
    : new ImapConnectionProvider(email).withPassword(host, password, port);

  let imapConnection = null;
  let miningTask = null;

  try {
    // Connect to validate connection before creating the pool.
    imapConnection = await imapConnectionProvider.acquireConnection();
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
    const newError = generateErrorObjectFromImapError(err);

    await imapConnectionProvider.releaseConnection(imapConnection);
    await imapConnectionProvider.cleanPool();
    res.status(newError.code);
    return next(new Error(newError.message));
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
