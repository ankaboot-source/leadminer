import Connection, { Box, parseHeader } from 'imap';
import { EXCLUDED_IMAP_FOLDERS } from '../../utils/constants';
import { getMessageId } from '../../utils/helpers/emailHeaderHelpers';
import hashEmail from '../../utils/helpers/hashHelpers';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
import { RedisEmailSignatureCache } from '../../services/cache/redis/RedisEmailSignatureCache';
import ImapConnectionProvider from './ImapConnectionProvider';
import { EmailMessage } from './types';

const redisClient = redis.getClient();
const signatureCache = new RedisEmailSignatureCache(redisClient);

// ... rest of your original code with the signature extraction added to publishEmailMessage ...
