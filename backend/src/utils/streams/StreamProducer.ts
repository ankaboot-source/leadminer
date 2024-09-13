export default interface StreamProducer<T> {
  produce(data: T[]): Promise<void>;
}
