export { Task } from './tasks/Task';
export type { TaskConfig } from './tasks/Task';
export { MiningManager } from './MiningManager';
export type { MiningManagerConfig, MiningManagerDeps } from './MiningManager';
export { MiningManagerService } from './MiningManagerService';
export type {
  MiningManagerServiceDeps,
  CreateImapTaskOptions,
  CreateFileTaskOptions,
  CreatePstTaskOptions
} from './MiningManagerService';
export {
  createImapMining,
  createFileMining,
  createPstMining
} from './factories';
export type {
  CreateImapMiningParams,
  CreateFileMiningParams,
  CreatePstMiningParams
} from './factories';
export * from './types';
export { FetchTask } from './tasks/FetchTask';
export type { FetcherClient, FetchTaskConfig } from './tasks/FetchTask';
export { ExtractTask } from './tasks/ExtractTask';
export type { ExtractTaskConfig } from './tasks/ExtractTask';
export { CleanTask } from './tasks/CleanTask';
export type { CleanTaskConfig } from './tasks/CleanTask';
export { SignatureTask } from './tasks/SignatureTask';
export type { SignatureTaskConfig } from './tasks/SignatureTask';
