import ImapConnectionProvider from '../imap/ImapConnectionProvider';
import ImapEmailsFetcher from '../imap/ImapEmailsFetcher';

interface Options {
  email: string;
  userId: string;
  batchSize: number;
  boxes: string[];
  imapConnectionProvider: ImapConnectionProvider;
  miningId: string;
  streamName: string;
  fetchEmailBody: boolean;
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
    streamName,
    fetchEmailBody,
    batchSize
  }: Options) {
    return new ImapEmailsFetcher(
      imapConnectionProvider,
      boxes,
      userId,
      email,
      miningId,
      streamName,
      fetchEmailBody,
      batchSize
    );
  }
}
