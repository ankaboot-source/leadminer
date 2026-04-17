export interface StreamInfo {
  streamName: string;
  consumerGroup?: string;
  role: 'extract' | 'clean' | 'signature';
}

export interface StreamCommand {
  miningId: string;
  command: 'REGISTER' | 'DELETE';
  streams: StreamInfo[];
}
