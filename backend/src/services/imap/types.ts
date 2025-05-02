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
  type: 'email';
  data: {
    header: unknown;
    body?: string;
    signature?: string;
    seqNumber: number;
    isLast: boolean;
    folderPath: string;
  };
  userId: string;
  userEmail: string;
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
