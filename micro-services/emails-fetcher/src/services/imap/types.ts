import ImapConnectionProvider from './ImapConnectionProvider';

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
  batchSize: number;
  boxes: string[];
  imapConnectionProvider: ImapConnectionProvider;
  fetchEmailBody: boolean;
  since?: string;
  /** Resume point (per-folder UID watermark) for incremental mining. */
  resumeFrom?: ImapResumeCursor | null;
}

/**
 * Per-folder UID watermark describing how far into a mailbox a previous
 * successful run mined. `uidvalidity` is the mailbox identity (imapflow
 * reports it as BigInt, so we carry it as a string); `last_uid` is the highest
 * UID fully mined. The next run resumes at `last_uid + 1`.
 */
export interface FolderWatermark {
  uidvalidity: string;
  last_uid: number;
  updated_at: string;
}

/** Resume input the caller (backend / edge fn) passes with the fetch request. */
export interface ImapResumeCursor {
  folders: Record<string, { uidvalidity: string; last_uid: number }>;
}

/** Watermark emitted back on completion so callers can persist it centrally. */
export interface ImapWatermarkCursor {
  folders: Record<string, FolderWatermark>;
}
