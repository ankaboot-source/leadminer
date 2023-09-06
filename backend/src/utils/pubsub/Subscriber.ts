export default interface Subscriber<T> {
  subscribe(onMessage: (data: T) => void | Promise<void>): Promise<void>;
  unsubscribe(): Promise<void>;
}
