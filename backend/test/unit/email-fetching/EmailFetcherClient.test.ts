import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import EmailFetcherClient from '../../../src/services/email-fetching/index';

describe('EmailFetcherClient', () => {
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
    it('should flatten fetchParams into top-level payload for IMAP mining', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          data: { miningId: 'mining-123', totalMessages: 50 },
          error: null
        }
      });

      const client = new EmailFetcherClient(
        mockLogger as any,
        'test-token',
        'http://localhost:8084'
      );

      (client as any).client = {
        post: mockPost,
        delete: mockDelete
      };

      await client.startFetch({
        userId: 'user-123',
        miningId: 'mining-456',
        contactStream: 'messages_stream-mining-456',
        signatureStream: 'signature_stream',
        extractSignatures: true,
        fetchParams: {
          email: 'test@example.com',
          folders: ['INBOX', 'Sent'],
          since: '2024-01-01'
        }
      });

      expect(mockPost).toHaveBeenCalledWith(
        'api/imap/fetch/start',
        expect.objectContaining({
          userId: 'user-123',
          miningId: 'mining-456',
          contactStream: 'messages_stream-mining-456',
          signatureStream: 'signature_stream',
          extractSignatures: true,
          email: 'test@example.com',
          boxes: ['INBOX', 'Sent'],
          since: '2024-01-01'
        })
      );
    });

    it('should not include fetchParams in the API payload', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          data: { miningId: 'mining-123', totalMessages: 50 },
          error: null
        }
      });

      const client = new EmailFetcherClient(
        mockLogger as any,
        'test-token',
        'http://localhost:8084'
      );

      (client as any).client = {
        post: mockPost,
        delete: mockDelete
      };

      await client.startFetch({
        userId: 'user-123',
        miningId: 'mining-456',
        contactStream: 'messages_stream-mining-456',
        signatureStream: 'signature_stream',
        extractSignatures: true,
        fetchParams: {
          email: 'test@example.com',
          folders: ['INBOX']
        }
      });

      expect(mockPost).toHaveBeenCalledWith(
        'api/imap/fetch/start',
        expect.not.objectContaining({ fetchParams: expect.anything() })
      );
    });

    it('should handle missing optional fields', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          data: { miningId: 'mining-123', totalMessages: 50 },
          error: null
        }
      });

      const client = new EmailFetcherClient(
        mockLogger as any,
        'test-token',
        'http://localhost:8084'
      );

      (client as any).client = {
        post: mockPost,
        delete: mockDelete
      };

      await client.startFetch({
        userId: 'user-123',
        miningId: 'mining-456',
        contactStream: 'messages_stream-mining-456',
        signatureStream: '',
        extractSignatures: false,
        fetchParams: {
          email: 'test@example.com',
          folders: ['INBOX']
        }
      });

      expect(mockPost).toHaveBeenCalledWith(
        'api/imap/fetch/start',
        expect.objectContaining({
          userId: 'user-123',
          miningId: 'mining-456',
          email: 'test@example.com',
          boxes: ['INBOX'],
          since: undefined
        })
      );
    });

    it('should log and rethrow on error', async () => {
      const axiosError = new Error('Request failed');
      mockPost.mockRejectedValueOnce(axiosError);

      const client = new EmailFetcherClient(
        mockLogger as any,
        'test-token',
        'http://localhost:8084'
      );

      (client as any).client = {
        post: mockPost,
        delete: mockDelete
      };

      await expect(
        client.startFetch({
          userId: 'user-123',
          miningId: 'mining-456',
          contactStream: 'messages_stream-mining-456',
          signatureStream: '',
          extractSignatures: false,
          fetchParams: {
            email: 'test@example.com',
            folders: ['INBOX']
          }
        })
      ).rejects.toThrow('Request failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Start fetching request failed',
        expect.objectContaining({ error: axiosError })
      );
    });
  });

  describe('stopFetch', () => {
    it('should send correct payload to stop endpoint', async () => {
      mockDelete.mockResolvedValueOnce({
        data: { error: null }
      });

      const client = new EmailFetcherClient(
        mockLogger as any,
        'test-token',
        'http://localhost:8084'
      );

      (client as any).client = {
        post: mockPost,
        delete: mockDelete
      };

      await client.stopFetch({
        miningId: 'mining-456',
        canceled: true
      });

      expect(mockDelete).toHaveBeenCalledWith(
        'api/imap/fetch/stop',
        expect.objectContaining({
          data: {
            miningId: 'mining-456',
            canceled: true
          }
        })
      );
    });

    it('should log and rethrow on error', async () => {
      const axiosError = new Error('Delete failed');
      mockDelete.mockRejectedValueOnce(axiosError);

      const client = new EmailFetcherClient(
        mockLogger as any,
        'test-token',
        'http://localhost:8084'
      );

      (client as any).client = {
        post: mockPost,
        delete: mockDelete
      };

      await expect(
        client.stopFetch({
          miningId: 'mining-456',
          canceled: false
        })
      ).rejects.toThrow('Delete failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Stop fetching request failed',
        expect.objectContaining({ error: axiosError })
      );
    });
  });
});
