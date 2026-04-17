import { Pipeline } from './Pipeline';
import type { PipelineDeps } from './Pipeline';
import { Task } from './tasks/Task';
import { FetchTask } from './tasks/FetchTask';
import type { FetcherClient } from './tasks/FetchTask';
import { ExtractTask } from './tasks/ExtractTask';
import { CleanTask } from './tasks/CleanTask';
import { SignatureTask } from './tasks/SignatureTask';
import { TaskId } from './types';
import ENV from '../../config';

export interface CreateImapMiningParams {
  miningId: string;
  userId: string;
  email: string;
  boxes: string[];
  fetchEmailBody: boolean;
  passiveMining?: boolean;
  since?: string;
  cleaningEnabled: boolean;
  fetcherClient: FetcherClient;
}

export function createImapMining(
  params: CreateImapMiningParams,
  deps: PipelineDeps
): Pipeline {
  const { miningId } = params;

  const streams = {
    messagesStream: `messages_stream-${miningId}`,
    emailsStream: `emails_stream-${miningId}`,
    messagesConsumerGroup: ENV.REDIS_EXTRACTING_STREAM_CONSUMER_GROUP,
    emailsConsumerGroup: ENV.REDIS_CLEANING_STREAM_CONSUMER_GROUP,
    signatureStream: ENV.REDIS_SIGNATURE_STREAM_NAME
  };

  const tasks: Task[] = [];

  tasks.push(
    new FetchTask({
      miningId,
      userId: params.userId,
      outputStream: streams.messagesStream,
      fetcherClient: params.fetcherClient,
      extractSignatures: params.fetchEmailBody,
      signatureStream: streams.signatureStream,
      fetchParams: {
        email: params.email,
        folders: params.boxes,
        since: params.since
      },
      passive_mining: params.passiveMining
    })
  );

  tasks.push(
    new ExtractTask({
      miningId,
      userId: params.userId,
      streams: {
        role: TaskId.Extract,
        input: [
          {
            streamName: streams.messagesStream,
            consumerGroup: streams.messagesConsumerGroup
          }
        ],
        output: [
          {
            streamName: streams.emailsStream
          }
        ]
      },
      passive_mining: params.passiveMining
    })
  );

  if (params.cleaningEnabled) {
    tasks.push(
      new CleanTask({
        miningId,
        userId: params.userId,
        streams: {
          role: TaskId.Clean,
          input: [
            {
              streamName: streams.emailsStream,
              consumerGroup: streams.emailsConsumerGroup
            }
          ],
          output: []
        },
        passive_mining: params.passiveMining
      })
    );
  }

  if (params.fetchEmailBody) {
    tasks.push(
      new SignatureTask({
        miningId,
        userId: params.userId,
        streams: {
          role: TaskId.Signature,
          input: [{ streamName: streams.signatureStream }],
          output: []
        },
        passive_mining: params.passiveMining
      })
    );
  }

  const pipeline = new Pipeline(
    {
      miningId,
      userId: params.userId,
      source: { type: 'email', source: params.email },
      tasks
    },
    deps
  );

  pipeline.addProgressLink(TaskId.Extract, TaskId.Fetch);

  if (params.cleaningEnabled) {
    pipeline.addProgressLink(TaskId.Clean, TaskId.Extract, {
      totalFrom: 'createdContacts'
    });
  }

  if (params.fetchEmailBody) {
    pipeline.addProgressLink(TaskId.Signature, TaskId.Fetch, {
      skipTotal: true
    });
  }

  return pipeline;
}

export interface CreateFileMiningParams {
  miningId: string;
  userId: string;
  fileName: string;
  totalImported: number;
  cleaningEnabled: boolean;
}

export function createFileMining(
  params: CreateFileMiningParams,
  deps: PipelineDeps
): Pipeline {
  const { miningId } = params;

  const streams = {
    messagesStream: `messages_stream-${miningId}`,
    emailsStream: `emails_stream-${miningId}`,
    messagesConsumerGroup: ENV.REDIS_EXTRACTING_STREAM_CONSUMER_GROUP,
    emailsConsumerGroup: ENV.REDIS_CLEANING_STREAM_CONSUMER_GROUP
  };

  const tasks: Task[] = [];

  tasks.push(
    new ExtractTask({
      miningId,
      userId: params.userId,
      streams: {
        role: TaskId.Extract,
        input: [
          {
            streamName: streams.messagesStream,
            consumerGroup: streams.messagesConsumerGroup
          }
        ],
        output: [
          {
            streamName: streams.emailsStream
          }
        ]
      }
    })
  );

  if (params.cleaningEnabled) {
    tasks.push(
      new CleanTask({
        miningId,
        userId: params.userId,
        streams: {
          role: TaskId.Clean,
          input: [
            {
              streamName: streams.emailsStream,
              consumerGroup: streams.emailsConsumerGroup
            }
          ],
          output: []
        }
      })
    );
  }

  const pipeline = new Pipeline(
    {
      miningId,
      userId: params.userId,
      source: { type: 'file', source: params.fileName },
      tasks
    },
    deps
  );

  if (params.cleaningEnabled) {
    pipeline.addProgressLink(TaskId.Clean, TaskId.Extract, {
      totalFrom: 'createdContacts'
    });
  }

  const extractTask = pipeline.getTask<ExtractTask>(TaskId.Extract);
  if (!extractTask) {
    throw new Error(`ExtractTask not found in pipeline ${miningId}`);
  }
  extractTask.progress.total = params.totalImported;
  extractTask.upstreamDone = true;

  return pipeline;
}

export interface CreatePstMiningParams {
  miningId: string;
  userId: string;
  source: string;
  fetchEmailBody: boolean;
  cleaningEnabled: boolean;
  fetcherClient: FetcherClient;
}

export function createPstMining(
  params: CreatePstMiningParams,
  deps: PipelineDeps
): Pipeline {
  const { miningId } = params;

  const streams = {
    messagesStream: `messages_stream-${miningId}`,
    emailsStream: `emails_stream-${miningId}`,
    messagesConsumerGroup: ENV.REDIS_EXTRACTING_STREAM_CONSUMER_GROUP,
    emailsConsumerGroup: ENV.REDIS_CLEANING_STREAM_CONSUMER_GROUP,
    signatureStream: ENV.REDIS_SIGNATURE_STREAM_NAME
  };

  const tasks: Task[] = [];

  tasks.push(
    new FetchTask({
      miningId,
      userId: params.userId,
      outputStream: streams.messagesStream,
      fetcherClient: params.fetcherClient,
      extractSignatures: params.fetchEmailBody,
      signatureStream: streams.signatureStream,
      fetchParams: {
        folders: ['/'],
        source: params.source
      }
    })
  );

  tasks.push(
    new ExtractTask({
      miningId,
      userId: params.userId,
      streams: {
        role: TaskId.Extract,
        input: [
          {
            streamName: streams.messagesStream,
            consumerGroup: streams.messagesConsumerGroup
          }
        ],
        output: [
          {
            streamName: streams.emailsStream
          }
        ]
      }
    })
  );

  if (params.cleaningEnabled) {
    tasks.push(
      new CleanTask({
        miningId,
        userId: params.userId,
        streams: {
          role: TaskId.Clean,
          input: [
            {
              streamName: streams.emailsStream,
              consumerGroup: streams.emailsConsumerGroup
            }
          ],
          output: []
        }
      })
    );
  }

  if (params.fetchEmailBody) {
    tasks.push(
      new SignatureTask({
        miningId,
        userId: params.userId,
        streams: {
          role: TaskId.Signature,
          input: [{ streamName: streams.signatureStream }],
          output: []
        }
      })
    );
  }

  const pipeline = new Pipeline(
    {
      miningId,
      userId: params.userId,
      source: { type: 'pst', source: params.source },
      tasks
    },
    deps
  );

  pipeline.addProgressLink(TaskId.Extract, TaskId.Fetch);

  if (params.cleaningEnabled) {
    pipeline.addProgressLink(TaskId.Clean, TaskId.Extract, {
      totalFrom: 'createdContacts'
    });
  }

  if (params.fetchEmailBody) {
    pipeline.addProgressLink(TaskId.Signature, TaskId.Fetch, {
      skipTotal: true
    });
  }

  return pipeline;
}
