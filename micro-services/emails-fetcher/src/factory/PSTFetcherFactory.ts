import PSTEmailsFetcher from '../services/pst/PSTEmailsFetcher'; //!

interface Options {
  email: string;
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
    email,
    miningId,
    contactStream,
    signatureStream,
    fetchEmailBody
  }: Options) {
    return new PSTEmailsFetcher(
      userId,
      email,
      miningId,
      contactStream,
      signatureStream,
      fetchEmailBody
    );
  }
}
