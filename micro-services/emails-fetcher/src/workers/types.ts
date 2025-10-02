export interface WorkerTask {
  headersBuf: Buffer;
  bodyTextBuf?: Buffer | null;

  // values needed by worker for publishing
  emailTextMaxLength: number;
  from: any;  // shape of envelope.from
  date: string | null;
  header: Record<string, string[]>;
  seq: number;
  folderPath: string;
  signatureStream: string;
  userId: string;
  userEmail: string;
  userIdentifier: string;
  miningId: string;
  messageId: string;
}