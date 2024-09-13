// eslint-disable-next-line import/prefer-default-export
export function* chunkGenerator<T>(array: T[], size: number) {
  for (let i = 0; i < array.length; i += size) {
    yield array.slice(i, i + size);
  }
}
