import ImapConnectionProvider from '../services/imap/ImapConnectionProvider';
import ImapEmailsFetcher from '../services/imap/ImapEmailsFetcher';

interface Options {
  email: string;
  userId: string;
  batchSize: number;
  boxes: string[];
  imapConnectionProvider: ImapConnectionProvider;
  miningId: string;
  contactStream: string;
  signatureStream: string;
  fetchEmailBody: boolean;
  maxConcurrentConnections: number;
  filterBodySize: number | undefined;
}

export default class EmailFetcherFactory {
  /**
   * Creates a new EmailFetcher instance.
   */
  // eslint-disable-next-line class-methods-use-this
  create({
    imapConnectionProvider,
    boxes,
    userId,
    email,
    miningId,
    contactStream,
    signatureStream,
    fetchEmailBody,
    batchSize,
    maxConcurrentConnections,
    filterBodySize
  }: Options) {
    return new ImapEmailsFetcher(
      imapConnectionProvider,
      boxes,
      userId,
      email,
      miningId,
      contactStream,
      signatureStream,
      fetchEmailBody,
      batchSize,
      maxConcurrentConnections,
      filterBodySize
    );
  }
}
