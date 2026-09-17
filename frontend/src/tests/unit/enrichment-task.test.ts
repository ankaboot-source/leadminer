import { describe, expect, it } from 'vitest';

import {
  isTaskRunning,
  isTerminalStatus,
  normalizeTask,
  pickRunningTask,
  taskProgress,
} from '@/utils/enrichment';

describe('normalizeTask', () => {
  it('maps the flat PostgREST projection shape', () => {
    expect(
      normalizeTask({
        id: 't1',
        status: 'running',
        total_enriched: 3,
        total_to_enrich: 10,
      }),
    ).toEqual({
      id: 't1',
      status: 'running',
      details: { total_enriched: 3, total_to_enrich: 10 },
    });
  });

  it('maps the nested realtime payload shape', () => {
    expect(
      normalizeTask({
        id: 't2',
        status: 'done',
        details: { total_enriched: 8, total_to_enrich: 11 },
      }),
    ).toEqual({
      id: 't2',
      status: 'done',
      details: { total_enriched: 8, total_to_enrich: 11 },
    });
  });

  it('defaults missing counters to zero', () => {
    expect(normalizeTask({ id: 't3', status: 'done' })?.details).toEqual({
      total_enriched: 0,
      total_to_enrich: 0,
    });
  });

  it('rejects rows without an id or status', () => {
    expect(normalizeTask(null)).toBeNull();
    expect(normalizeTask({ id: 't4' })).toBeNull();
    expect(normalizeTask({ status: 'running' })).toBeNull();
  });
});

describe('pickRunningTask', () => {
  it('returns the first running task', () => {
    const task = pickRunningTask([
      { id: 'a', status: 'done', details: {} },
      {
        id: 'b',
        status: 'running',
        details: { total_enriched: 1, total_to_enrich: 5 },
      },
    ]);
    expect(task?.id).toBe('b');
  });

  it('returns null when none are running', () => {
    expect(pickRunningTask([{ id: 'a', status: 'done' }])).toBeNull();
    expect(pickRunningTask(null)).toBeNull();
    expect(pickRunningTask([])).toBeNull();
  });
});

describe('status helpers', () => {
  it('detects a running task', () => {
    expect(
      isTaskRunning({
        id: 'a',
        status: 'running',
        details: { total_enriched: 0, total_to_enrich: 1 },
      }),
    ).toBe(true);
    expect(
      isTaskRunning({
        id: 'a',
        status: 'done',
        details: { total_enriched: 0, total_to_enrich: 1 },
      }),
    ).toBe(false);
    expect(isTaskRunning(null)).toBe(false);
  });

  it('detects terminal statuses', () => {
    expect(isTerminalStatus('done')).toBe(true);
    expect(isTerminalStatus('canceled')).toBe(true);
    expect(isTerminalStatus('running')).toBe(false);
    expect(isTerminalStatus(undefined)).toBe(false);
  });
});

describe('taskProgress', () => {
  it('reads counters and defaults to zero when idle', () => {
    expect(
      taskProgress({
        id: 'a',
        status: 'running',
        details: { total_enriched: 4, total_to_enrich: 9 },
      }),
    ).toEqual({ done: 4, total: 9 });
    expect(taskProgress(null)).toEqual({ done: 0, total: 0 });
  });
});
