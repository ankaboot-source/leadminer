import RealtimeSSE from '../../utils/helpers/sseHelpers';

export default class SSEBroadcasterFactory {
  /**
   * Creates a new instance of `SSEBroadcasterClass`.
   */
  // eslint-disable-next-line class-methods-use-this
  create() {
    return new RealtimeSSE();
  }
}
