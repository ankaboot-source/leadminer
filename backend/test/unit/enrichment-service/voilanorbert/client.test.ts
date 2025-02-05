import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals';

import axios from 'axios';
import { Logger } from 'winston';
import VoilanorbertApi from '../../../../src/services/enrichment/voilanorbert/client';
import { logError } from '../../../../src/utils/axios';

jest.mock('axios');

const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn()
};
(axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

jest.mock('../../../../src/utils/axios', () => ({
  logError: jest.fn()
}));

describe('VoilanorbertApi', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn()
  } as unknown as Logger;
  const config = {
    url: 'https://api.voilanorbert.com',
    username: 'testUser',
    apiToken: 'testToken',
    rateLimiter: {
      requests: 5,
      interval: 200,
      spaced: false
    }
  };

  let voilanorbert: VoilanorbertApi;

  beforeEach(() => {
    voilanorbert = new VoilanorbertApi(config, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enrich', () => {
    it('should successfully enrich emails', async () => {
      const emails = ['test@example.com'];
      const webhook = 'webhook-url';

      const mockResponse = {
        status: 'success',
        success: true,
        token: 'testToken'
      };

      mockAxiosInstance.post.mockReturnValue({ data: mockResponse });

      const response = await voilanorbert.enrich(emails, webhook);

      expect(response).toEqual(mockResponse);
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: config.url,
        headers: {},
        auth: {
          username: config.username,
          password: config.apiToken
        }
      });
    });

    it('should limit to 5 requests every second', async () => {
      const emails = [
        'test1@example.com',
        'test2@example.com',
        'test3@example.com'
      ];
      const webhook = 'webhook-url';

      const requests = Array.from({ length: 10 }, () =>
        voilanorbert.enrich(emails, webhook)
      );

      const start = Date.now();
      await Promise.allSettled(requests);
      const end = Date.now();

      const duration = end - start;
      const tolerance = 10; // Allow a 10ms margin of error to account for slight timing variations

      expect(duration).toBeGreaterThanOrEqual(1000 - tolerance);
      expect(axios.create().post).toHaveBeenCalledTimes(5);
    });

    it('should log an error and throw it when the request fails', async () => {
      const emails = ['test@example.com'];
      const webhook = 'webhook-url';
      const mockError = new Error('Request failed');

      mockAxiosInstance.post.mockImplementation(() =>
        Promise.reject(mockError)
      );

      await expect(voilanorbert.enrich(emails, webhook)).rejects.toThrow(
        mockError
      );
      expect(logError).toHaveBeenCalledWith(
        mockError,
        expect.any(String),
        mockLogger
      );
    });
  });
});
