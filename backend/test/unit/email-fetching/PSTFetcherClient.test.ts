import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { Logger } from 'winston';
import PSTFetcherClient from '../../../src/services/email-fetching/pst';

describe('PSTFetcherClient', () => {
  let mockLogger: { error: jest.Mock; info: jest.Mock; warn: jest.Mock };
  let mockPost: jest.Mock;
  let mockDelete: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
    mockPost = jest.fn();
    mockDelete = jest.fn();
  });

  describe('startFetch', () => {
    it('should flatten fetchParams.source into top-level payload', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          data: { miningId: 'mining-123', totalMessages: 50 },
          error: null
        }
      });

      const client = new PSTFetcherClient(
        mockLogger as unknown as Logger,
        'test-token',
        'http://localhost:3000'
      );

      (
        client as unknown as { client: { post: jest.Mock; delete: jest.Mock } }
      ).client = {
        post: mockPost,
        delete: mockDelete
      };

      await client.startFetch({
        userId: 'user-123',
        miningId: 'mining-456',
        source: 'user-123/file.pst',
        extractSignatures: true,
        contactStream: 'messages_stream-mining-456',
        signatureStream: 'signature_stream'
      });

      expect(mockPost).toHaveBeenCalledWith(
        'api/pst/fetch/start',
        expect.objectContaining({
          userId: 'user-123',
          miningId: 'mining-456',
          source: 'user-123/file.pst',
          extractSignatures: true,
          contactStream: 'messages_stream-mining-456',
          signatureStream: 'signature_stream'
        })
      );
    });

    it('should pass through other fetchParams fields', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          data: { miningId: 'mining-123', totalMessages: 50 },
          error: null
        }
      });

      const client = new PSTFetcherClient(
        mockLogger as unknown as Logger,
        'test-token',
        'http://localhost:3000'
      );

      (
        client as unknown as { client: { post: jest.Mock; delete: jest.Mock } }
      ).client = {
        post: mockPost,
        delete: mockDelete
      };

      await (
        client as unknown as { startFetch: typeof client.startFetch }
      ).startFetch({
        userId: 'user-123',
        miningId: 'mining-456',
        source: 'user-123/file.pst',
        extractSignatures: true,
        contactStream: 'messages_stream-mining-456',
        signatureStream: 'signature_stream',
        fetchParams: { source: 'user-123/file.pst' }
      });

      expect(mockPost).toHaveBeenCalledWith(
        'api/pst/fetch/start',
        expect.not.objectContaining({ fetchParams: expect.anything() })
      );
    });

    it('should throw on 422 PST parse error', async () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 422, data: { message: 'Failed to parse PST file' } }
      };
      mockPost.mockRejectedValueOnce(axiosError);

      const client = new PSTFetcherClient(
        mockLogger as unknown as Logger,
        'test-token',
        'http://localhost:3000'
      );

      (
        client as unknown as { client: { post: jest.Mock; delete: jest.Mock } }
      ).client = {
        post: mockPost,
        delete: mockDelete
      };

      await expect(
        client.startFetch({
          userId: 'user-123',
          miningId: 'mining-456',
          source: 'user-123/corrupt.pst',
          extractSignatures: false,
          contactStream: 'stream',
          signatureStream: 'sig'
        })
      ).rejects.toThrow('Failed to parse PST file');
    });
  });
});
