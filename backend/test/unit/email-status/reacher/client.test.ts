import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Logger } from 'winston'; // Assuming you're using Winston for logging
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals';
import ReacherClient from '../../../../src/services/email-status/reacher/client';

// Mock logger for testing
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
} as unknown as Logger;

const BASE_CONFIG = {
  host: 'https://api.reacher.com',
  rateLimiter: {
    requests: 1,
    interval: 1000,
    spaced: true
  }
};
const SINGLE_VERIFICATION_ENDPOINT = ReacherClient.SINGLE_VERIFICATION_PATH;
const BULK_VERIFICATION_ENDPOINT = ReacherClient.BULK_VERIFICATION_PATH;

describe('ReacherClient', () => {
  let mockAxios: MockAdapter;
  let reacherClient: ReacherClient;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
    reacherClient = new ReacherClient(mockLogger, BASE_CONFIG);
  });

  afterEach(() => {
    mockAxios.restore();
    jest.clearAllMocks();
  });

  describe('#checkSingleEmail', () => {
    const validEmail = 'test@example.com';
    const successResponse = {
      input: 'test@example.com',
      is_reachable: 'safe',
      misc: { is_disposable: false, is_role_account: false },
      mx: { accepts_mail: true, records: ['mx.example.com'] },
      smtp: { can_connect_smtp: true, is_deliverable: true },
      syntax: {
        domain: 'example.com',
        is_valid_syntax: true,
        username: 'test'
      }
    };

    beforeEach(() => {
      mockAxios
        .onPost(SINGLE_VERIFICATION_ENDPOINT)
        .reply(200, successResponse);
    });

    it('should make a POST request to the correct endpoint', async () => {
      await reacherClient.checkSingleEmail(validEmail);
      expect(mockAxios.history.post.length).toBe(1);
      expect(mockAxios.history.post[0].url).toBe(SINGLE_VERIFICATION_ENDPOINT);
    });

    it('should return response successfully', async () => {
      mockAxios
        .onPost(SINGLE_VERIFICATION_ENDPOINT)
        .reply(200, successResponse);
      const result = await reacherClient.checkSingleEmail('test@example.com');
      expect(result).toEqual(successResponse);
    });

    it('should include additionalSettings in request body', async () => {
      const specialClient = new ReacherClient(mockLogger, {
        ...BASE_CONFIG,
        microsoft365UseApi: true,
        smtpRetries: 3,
        smtpTimeoutSeconds: 5
      });

      await specialClient.checkSingleEmail(validEmail);

      const requestBody = JSON.parse(mockAxios.history.post[0].data);
      expect(requestBody).toMatchObject({
        microsoft365_use_api: true,
        retries: 3,
        smtp_timeout: { secs: 5, nanos: 0 }
      });
    });

    it('should include SMTP config in request body', async () => {
      const specialClient = new ReacherClient(mockLogger, {
        ...BASE_CONFIG,
        smtpConfig: {
          fromEmail: 'noreply@company.com',
          helloName: 'mail-checker',
          proxy: {
            host: 'proxy.company.com',
            port: 8080
          }
        }
      });

      await specialClient.checkSingleEmail(validEmail);

      const requestBody = JSON.parse(mockAxios.history.post[0].data);
      expect(requestBody).toMatchObject({
        from_email: 'noreply@company.com',
        hello_name: 'mail-checker',
        proxy: {
          host: 'proxy.company.com',
          port: 8080
        }
      });
    });

    it('should use smtpConfig.from_email when no validation options', async () => {
      const smtpConfig = { fromEmail: 'default@company.com' };
      const specialClient = new ReacherClient(mockLogger, {
        ...BASE_CONFIG,
        smtpConfig
      });

      await specialClient.checkSingleEmail(validEmail);

      const requestBody = JSON.parse(mockAxios.history.post[0].data);
      expect(requestBody.from_email).toBe(smtpConfig.fromEmail);
    });

    it('should prioritize validationOptions.fromEmail over smtpConfig', async () => {
      const validationOptions = {
        fromEmail: 'override@validator.com'
      };
      const smtpConfig = { fromEmail: 'default@company.com' };
      const specialClient = new ReacherClient(mockLogger, {
        ...BASE_CONFIG,
        smtpConfig
      });

      await specialClient.checkSingleEmail(
        validEmail,
        undefined,
        validationOptions
      );

      const requestBody = JSON.parse(mockAxios.history.post[0].data);
      expect(requestBody.from_email).toBe(validationOptions.fromEmail);
    });

    it('should abort request immediately when signal is pre-aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        reacherClient.checkSingleEmail(validEmail, controller.signal)
      ).rejects.toThrow('canceled');
    });

    it('should cancel in-flight request when aborted', async () => {
      const controller = new AbortController();
      let requestAborted = false;

      mockAxios.onPost(SINGLE_VERIFICATION_ENDPOINT).reply(
        () =>
          new Promise((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              requestAborted = true;
              reject(new Error('Request aborted'));
            });
          })
      );

      const requestPromise = reacherClient.checkSingleEmail(
        validEmail,
        controller.signal
      );
      setTimeout(() => controller.abort(), 100);

      await expect(requestPromise).rejects.toThrow('canceled');
      expect(requestAborted).toBe(true);
    });

    it('should not affect other requests when aborted', async () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      controller1.abort();

      const secondRequest = reacherClient.checkSingleEmail(
        validEmail,
        controller2.signal
      );

      await expect(secondRequest).resolves.toEqual(successResponse);
    });

    it('should properly use rate limiter', async () => {
      mockAxios
        .onPost(SINGLE_VERIFICATION_ENDPOINT)
        .reply(200, { valid: true });

      const startTime = Date.now();
      const requests = [
        await reacherClient.checkSingleEmail('test@example.com'),
        await reacherClient.checkSingleEmail('test@example.com'),
        await reacherClient.checkSingleEmail('test@example.com')
      ];
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeGreaterThanOrEqual(
        BASE_CONFIG.rateLimiter.interval * (requests.length - 1)
      );
    });

    it('should handle and rethrow API errors', async () => {
      mockAxios.onPost(SINGLE_VERIFICATION_ENDPOINT).reply(400, {
        error: 'Invalid email format'
      });

      await expect(
        reacherClient.checkSingleEmail('invalid-email')
      ).rejects.toThrow();

      expect.objectContaining({
        message: expect.stringContaining(
          '[Reacher:checkSingleEmail:invalid-email]: Request failed with status code 400'
        )
      });
    });
  });

  describe('#createBulkVerificationJob', () => {
    const JOB_ID = '12345';
    const sampleResponse = { job_id: JOB_ID, total_records: 3 };

    it('should create bulk job successfully', async () => {
      mockAxios.onPost(BULK_VERIFICATION_ENDPOINT).reply(200, sampleResponse);
      const result = await reacherClient.createBulkVerificationJob([
        'test1@example.com',
        'test2@example.com',
        'test3@example.com'
      ]);
      expect(result.job_id).toBe(JOB_ID);
    });
  });

  describe('#getJobStatus', () => {
    const JOB_ID = '12345';
    const sampleStatus = {
      job_id: JOB_ID,
      created_at: '2023-01-01',
      finished_at: '2023-01-01',
      total_records: 3,
      total_processed: 3,
      summary: {
        total_safe: 2,
        total_invalid: 1,
        total_risky: 0,
        total_unknown: 0
      },
      job_status: 'Completed'
    };

    it('should retrieve job status', async () => {
      mockAxios
        .onGet(`${BULK_VERIFICATION_ENDPOINT}/${JOB_ID}`)
        .reply(200, sampleStatus);
      const status = await reacherClient.getJobStatus(JOB_ID);
      expect(status.job_status).toBe('Completed');
    });
  });
});
