import { Logger } from 'winston';

export default function logMemoryStats(logger: Logger, context: string) {
  const { heapTotal, heapUsed } = process.memoryUsage();
  const totalAvailableHeap = (heapTotal / 1024 / 1024 / 1024).toFixed(2);
  const totalUsedHeap = (heapUsed / 1024 / 1024 / 1024).toFixed(2);

  logger.debug('Memory usage', {
    totalAvailableHeap,
    totalUsedHeap,
    context
  });
}
