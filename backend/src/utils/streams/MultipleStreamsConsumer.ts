export interface StreamData<T> {
  streamName: string;
  data: T[];
}

export default interface MultipleStreamsConsumer<T> {
  consume(streams: string[], minimumCount: number): Promise<StreamData<T>[]>;
}
