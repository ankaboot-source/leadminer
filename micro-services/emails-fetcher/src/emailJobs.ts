import ImapEmailsFetcher from './services/imap/ImapEmailsFetcher';

class EmailsFetchers {
  private readonly ACTIVE_FETCHERS = new Map<string, ImapEmailsFetcher>();

  exists(miningId: string) {
    const fetcher = this.ACTIVE_FETCHERS.get(miningId);
    return fetcher !== undefined;
  }

  async start(miningId: string, fetcher: ImapEmailsFetcher) {
    const existingFetcher = this.ACTIVE_FETCHERS.get(miningId);

    if (existingFetcher)
      throw new Error('Cannot start another fetching using same ID');

    this.ACTIVE_FETCHERS.set(miningId, fetcher);

    return fetcher.start();
  }

  async stop(miningId: string, canceled: boolean) {
    const existingFetcher = this.ACTIVE_FETCHERS.get(miningId);

    if (!existingFetcher) {
      throw new Error('No active fetcher found with this ID');
    }

    if (!existingFetcher.isCompleted && !existingFetcher.isCanceled) {
      await existingFetcher.stop(canceled);
    }

    this.ACTIVE_FETCHERS.delete(miningId);
  }
}

const EmailsFetcher = new EmailsFetchers();

export default EmailsFetcher;
