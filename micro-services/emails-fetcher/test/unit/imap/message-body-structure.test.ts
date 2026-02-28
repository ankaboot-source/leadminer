import { describe, it, expect } from '@jest/globals';
import type { FetchMessageObject, MessageStructureObject } from 'imapflow';
import { groupMessagesByTextPart } from '../../../src/services/imap/parsing';

const msg = (
  uid: number,
  bodyStructure: MessageStructureObject
): FetchMessageObject => ({ uid, bodyStructure }) as FetchMessageObject;

describe('groupMessagesByTextPart', () => {
  it('groups messages by same text/plain part', () => {
    const messages = [
      msg(1, {
        type: 'text/plain',
        part: '1',
        size: 100
      }),
      msg(2, {
        type: 'text/plain',
        part: '1',
        size: 100
      }),
      msg(3, {
        type: 'text/plain',
        part: '1',
        size: 100
      })
    ];

    const result = groupMessagesByTextPart(messages);

    expect(result).toEqual([[['1'], new Set([1, 2, 3])]]);
  });

  it('groups messages with different text/plain parts separately', () => {
    const messages = [
      msg(1, {
        type: 'text/plain',
        part: '1',
        size: 100
      }),
      msg(2, {
        type: 'text/plain',
        part: '1',
        size: 100
      }),
      msg(3, {
        type: 'text/plain',
        part: '1.1',
        size: 100
      }),
      msg(4, {
        type: 'text/plain',
        part: '1.1',
        size: 100
      }),
      msg(5, {
        type: 'text/plain',
        part: '1.1',
        size: 100
      })
    ];

    const result = groupMessagesByTextPart(messages);

    expect(result).toEqual([
      [['1'], new Set([1, 2])],
      [['1.1'], new Set([3, 4, 5])]
    ]);
  });

  it('groups messages with no text/plain under undefined', () => {
    const messages = [
      msg(1, {
        type: 'text/plain',
        part: '1',
        size: 100
      }),
      msg(2, {
        type: 'text/plain',
        part: '1.1',
        size: 100
      }),
      msg(3, {
        type: 'text/plain',
        size: 100
      }),
      msg(4, {
        type: 'text/plain',
        size: 100
      }),
      msg(5, {
        type: 'text/plain',
        size: 100
      })
    ];
    const result = groupMessagesByTextPart(messages);
    expect(result).toEqual([
      [['1'], new Set([1])],
      [['1.1'], new Set([2])],
      [undefined, new Set([3, 4, 5])]
    ]);
  });

  it('groups messages exceeding maxBodyTextSize under undefined', () => {
    const messages = [
      msg(1, {
        type: 'text/plain',
        part: '1',
        size: 100
      }),
      msg(2, {
        type: 'text/plain',
        part: '1',
        size: 100
      }),
      msg(3, {
        type: 'text/plain',
        part: '1.1',
        size: 1000
      }),
      msg(4, {
        type: 'text/plain',
        part: '1.1',
        size: 1000
      })
    ];
    const result = groupMessagesByTextPart(messages, 100);

    expect(result).toEqual([
      [['1'], new Set([1, 2])],
      [undefined, new Set([3, 4])]
    ]);
  });

  it('returns empty array for no messages', () => {
    const result = groupMessagesByTextPart([]);
    expect(result).toEqual([]);
  });

  it('falls back to __no_text__ when text/plain node has no part id', () => {
    const nodeWithoutPart: MessageStructureObject = {
      type: 'text/plain',
      size: 10
    };

    const messages = [msg(1, nodeWithoutPart)];

    const result = groupMessagesByTextPart(messages);

    expect(result).toEqual([[undefined, new Set([1])]]);
  });
});
