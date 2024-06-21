import axios from 'axios';
import { Logger } from 'winston';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  expect,
  test
} from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import ZerobounceClient from '../../../../src/services/email-status/zerobounce/client';
import sandbox from './sandbox';

describe('ZerobounceClient', () => {
  let logger: Logger;
  let axiosAdapter: MockAdapter;
  let client: ZerobounceClient;

  beforeEach(() => {
    axiosAdapter = new MockAdapter(axios);
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    } as unknown as Logger;

    client = new ZerobounceClient({ apiToken: 'test-api-token' }, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
    axiosAdapter.restore();
  });

  describe('verifyEmail', () => {
    test('Call the API with the correct headers & params', async () => {
      let initiatedGetRequest = false;
      const testcase = {
        email_address: 'valid@example.com',
        ip_address: null
      };

      axiosAdapter.onGet().reply((config) => {
        initiatedGetRequest = true;

        expect(config.params.api_key).toBe('test-api-token');
        expect(config.url).toBe('validate');

        expect(config.params.email).toEqual(testcase.email_address);
        expect(config.params.ip_address).toEqual('');

        return [200, sandbox['valid@example.com']];
      });

      await client.verifyEmail(testcase);

      expect(initiatedGetRequest).toBeTruthy();
    });
  });

  describe('verifyEmailBulk', () => {
    test('Call the API with correct body and batched emails', async () => {
      let initiatedPostRequest = false;

      const testcase = {
        email_address: 'valid@example.com',
        ip_address: null
      };

      axiosAdapter.onPost().reply((config) => {
        initiatedPostRequest = true;
        expect(config.url).toBe('validatebatch');
        expect(config.data).toEqual(
          JSON.stringify({
            body: {
              email_batch: [testcase],
              api_key: 'test-api-token'
            }
          })
        );

        return [200, { email_batch: sandbox['valid@example.com'] }];
      });

      await client.verifyEmailBulk([testcase]);

      expect(initiatedPostRequest).toBeTruthy();
    });

    test('Throws error when passing the maximum emails per request', async () => {
      const emailBatch = [
        { email_address: 'test1@example.com', ip_address: '123.123.123.123' }
      ];
      emailBatch.length = 201;
      await expect(client.verifyEmailBulk(emailBatch)).rejects.toThrow(
        `Maximum emails to validate per request is ${ZerobounceClient.BATCH_VALIDATION_LENGTH}`
      );
    });
  });
});
