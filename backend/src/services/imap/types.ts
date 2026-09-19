import { FolderStatus } from '../../db/types';

export interface ImapFolderCursor {
  /** IMAP mailbox identity. A changed value invalidates persisted UIDs. */
  uidvalidity: string | null;
  /** Next UID the server will assign; it is not necessarily an existing UID. */
  uidnext: number | null;
  /** uidnext - 1, used only as a high-water bound because UIDs may have gaps. */
  high_water_uid: number | null;
  /** Live mailbox EXISTS; compared against the watermark's message count. */
  messages: number | null;
}

/** Persisted per-folder watermark from the mining source config. */
export interface FolderWatermark {
  uidvalidity: string;
  last_uid: number;
  /** Mailbox EXISTS when the watermark was written. */
  total_messages?: number;
}

export interface FolderStatusInfo {
  status: FolderStatus;
  hasNewMessages: boolean;
  requiresFullScan: boolean;
}

export interface FlatTree {
  label: string;
  key: string;
  attribs?: string[];
  parent?: FlatTree;
  total?: number;
  cumulativeTotal?: number;
  cursor?: ImapFolderCursor;
  watermark?: FolderWatermark;
  /** Sync state derived by joining the live cursor with the watermark. */
  status: FolderStatus;
  has_new_messages: boolean;
  latest_uid: number | null;
  children?: FlatTree[];
}

/** Synthetic root returned by buildFinalTree (no folder status). */
export interface ImapTreeRoot {
  label: string;
  key: string;
  total: number;
  children: FlatTree[];
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
