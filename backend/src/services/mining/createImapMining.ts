import { Redis } from 'ioredis';
import MiningManager from './MiningManager';
import Task from '../tasks/task/Task';
import TaskFetch from '../tasks/task/TaskFetch';
import TaskExtract from '../tasks/task/TaskExtract';
import TaskClean from '../tasks/task/TaskClean';
import TaskSignature from '../tasks/task/TaskSignature';
import { EmailFetcherAdapter } from '../tasks/fetcher/EmailFetcherAdapter';
import { ImapEmailsFetcherOptions } from '../imap/types';
import ENV from '../../config';
import SupabaseTasks from '../../db/supabase/tasks';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';
import { flickrBase58IdGenerator } from '../tasks-manager/utils';
import EmailFetcherClient from '../email-fetching';
import RealtimeSSE from '../../utils/helpers/sseHelpers';

export function createImapMiningManager(
  tasksResolver: SupabaseTasks,
  redisSubscriber: Redis,
  redisPublisher: Redis,
  sseBroadcasterFactory: SSEBroadcasterFactory,
  _emailFetcherClient: EmailFetcherClient
): MiningManager {
  return new MiningManager({
    tasksResolver,
    redisSubscriber,
    redisPublisher,
    sseBroadcasterFactory,
    idGenerator: () => flickrBase58IdGenerator()()
  });
}

export function createImapTasks(
  miningId: string,
  userId: string,
  options: ImapEmailsFetcherOptions,
  sseBroadcaster: RealtimeSSE,
  redisSubscriber: Redis,
  redisPublisher: Redis,
  emailFetcherClient: EmailFetcherClient
): Task[] {
  const messagesStream = `messages_stream-${miningId}`;
  const emailsStream = `emails_stream-${miningId}`;

  const emailFetcher = new EmailFetcherAdapter(emailFetcherClient);

  return [
    new TaskFetch(
      {
        miningId,
        userId,
        fetchers: [emailFetcher],
        contactStream: messagesStream,
        signatureStream: ENV.REDIS_SIGNATURE_STREAM_NAME,
        extractSignatures: options.fetchEmailBody
      },
      sseBroadcaster
    ),
    new TaskExtract(
      {
        miningId,
        userId,
        redisSubscriber,
        redisPublisher,
        streamName: messagesStream,
        consumerGroup: ENV.REDIS_EXTRACTING_STREAM_CONSUMER_GROUP
      },
      sseBroadcaster
    ),
    new TaskClean(
      {
        miningId,
        userId,
        redisSubscriber,
        redisPublisher,
        streamName: emailsStream,
        consumerGroup: ENV.REDIS_CLEANING_STREAM_CONSUMER_GROUP
      },
      sseBroadcaster
    ),
    new TaskSignature(
      {
        miningId,
        userId
      },
      sseBroadcaster
    )
  ];
}
