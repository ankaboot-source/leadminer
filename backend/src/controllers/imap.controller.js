import { LEADMINER_FETCH_BATCH_SIZE } from '../config';
import db from '../db';
import { ImapBoxesFetcher } from '../services/ImapBoxesFetcher';
import ImapConnectionProvider from '../services/ImapConnectionProvider';
import { miningTasksManager } from '../services/TasksManager';
import { hashEmail } from '../utils/helpers/hashHelpers';
import logger from '../utils/logger';
import redis from '../utils/redis';
import {
  generateErrorObjectFromImapError,
  getUser,
  getXImapHeaderField,
  validateAndExtractImapParametersFromBody,
  validateImapCredentials
} from './helpers';

const redisClient = redis.getClient();

/**
 * Logs into an IMAP account.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {Promise<void>}
 */
export async function loginToAccount(req, res, next) {
  try {
    const { email, host, tls, port, password } =
      validateAndExtractImapParametersFromBody(req.body);

    await validateImapCredentials(host, email, password, port);

    const user =
      (await getUser({ email }, db)) ??
      (await db.createImapUser({ email, host, port, tls }));

    if (!user) {
      throw new Error(
        'Something went wrong on our end. Please try again later.'
      );
    }

    logger.info('IMAP login successful', { metadata: { email } });
    return res.status(200).send({ imap: user });
  } catch (err) {
    const errorResponse = new Error(err.message);
    errorResponse.errors = err.errors;
    res.status(err.errors ? 400 : 500);
    return next(errorResponse);
  }
}

/**
 * Retrieve mailbox folders.
 * @param {object} req - user request
 * @param {object} res - http response to be sent
 */
export async function getImapBoxes(req, res, next) {
  const { data, error } = getXImapHeaderField(req.headers);

  if (error) {
    res.status(400);
    return next(error);
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { accessToken, id, email, password } = data;
  const user = await getUser(data, db);

  if (user === null) {
    res.status(400);
    return next(new Error('user does not exists.'));
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { host, port, refresh_token } = user;
  const imapConnectionProvider = accessToken
    ? await new ImapConnectionProvider(email).withOauth(
        accessToken,
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
        user: hashEmail(email, id)
      }
    });
  } catch (err) {
    const generatedError = generateErrorObjectFromImapError(err);
    const newError = new Error(generatedError.message);
    newError.errors = generatedError.errors;
    return next(newError);
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
export async function startMining(req, res, next) {
  const { data, error } = getXImapHeaderField(req.headers);
  const { boxes } = req.body;

  if (error || boxes === undefined) {
    res.status(400);
    return next(error || new Error('Missing parameter boxes'));
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { accessToken, id, email, password } = data;
  const user = await getUser(data, db);

  if (user === null) {
    res.status(400);
    return next(new Error('user does not exists.'));
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { host, port, refresh_token } = user;

  const imapConnectionProvider = accessToken
    ? await new ImapConnectionProvider(email).withOauth(
        accessToken,
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
export async function getMiningTask(req, res, next) {
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
export async function stopMiningTask(req, res, next) {
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
