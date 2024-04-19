import ImapConnectionProvider from './ImapConnectionProvider';

export interface FlatTree {
  label: string;
  key: string;
  attribs?: string[];
  parent?: FlatTree;
  total?: number;
  cumulativeTotal?: number;
  children?: FlatTree[];
}

export interface EmailMessage {
  header: any;
  body?: string;
  seqNumber: number;
  isLast: boolean;
  userId: string;
  userEmail: string;
  folderName: string;
  userIdentifier: string;
  miningId: string;
}

export interface ImapEmailsFetcherOptions {
  email: string;
  userId: string;
  batchSize: number;
  boxes: string[];
  imapConnectionProvider: ImapConnectionProvider;
  fetchEmailBody: boolean;
}
