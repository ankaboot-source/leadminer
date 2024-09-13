export default interface Subscriber<T> {
  subscribe(onMessage: (data: T) => void | Promise<void>): Promise<void> | void;
  unsubscribe(): Promise<void> | void;
}
