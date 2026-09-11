export interface ImapFolderCursor {
  /** IMAP mailbox identity. A changed value invalidates persisted UIDs. */
  uidvalidity: string | null;
  /** Next UID the server will assign; it is not necessarily an existing UID. */
  uidnext: number | null;
  /** uidnext - 1, used only as a high-water bound because UIDs may have gaps. */
  high_water_uid: number | null;
}

export interface FlatTree {
  label: string;
  key: string;
  attribs?: string[];
  parent?: FlatTree;
  total?: number;
  cumulativeTotal?: number;
  cursor?: ImapFolderCursor;
  children?: FlatTree[];
}

export interface EmailMessage {
  type: 'email';
  data: {
    header: unknown;
    body?: string;
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
  boxes: string[];
  fetchEmailBody: boolean;
  cleaningEnabled?: boolean;
  since?: string;
}
