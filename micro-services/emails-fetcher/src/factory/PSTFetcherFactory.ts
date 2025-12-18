import PSTEmailsFetcher from '../services/pst/PSTEmailsFetcher'; //!

interface Options {
  userId: string;
  miningId: string;
  contactStream: string;
  signatureStream: string;
  fetchEmailBody: boolean;
}

export default class PSTFetcherFactory {
  /**
   * Creates a new EmailFetcher instance.
   */
  // eslint-disable-next-line class-methods-use-this
  create({
    userId,
    miningId,
    contactStream,
    signatureStream,
    fetchEmailBody
  }: Options) {
    return new PSTEmailsFetcher(
      userId,
      miningId,
      contactStream,
      signatureStream,
      fetchEmailBody
    );
  }
}
