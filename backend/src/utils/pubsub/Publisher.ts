export default interface Publisher<T> {
  publish(channel: string, data: T): Promise<void>;
}
