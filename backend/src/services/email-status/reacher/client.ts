import axios, { AxiosError, AxiosInstance } from 'axios';
import { Logger } from 'winston';
import { logError } from '../../../utils/axios';
import { IRateLimiter } from '../../rate-limiter/RateLimiter';

interface BulkSubmitResponse {
  job_id: string;
}

export interface CheckError {
  type: string;
  message: string;
}

export type Reachability = 'invalid' | 'unknown' | 'safe' | 'risky';

export interface EmailCheckOutput {
  input: string;
  is_reachable: Reachability;
  misc: Misc | CheckError;
  mx: Mx | CheckError;
  smtp: Smtp | CheckError;
  syntax: Syntax;
}

interface Misc {
  is_disposable: boolean;
  is_role_account: boolean;
}

interface Mx {
  accepts_mail: boolean;
  records: string[];
}

interface Smtp {
  can_connect_smtp: boolean;
  has_full_inbox: boolean;
  is_catch_all: boolean;
  is_deliverable: boolean;
  is_disabled: boolean;
}

export interface Syntax {
  domain: string;
  is_valid_syntax: boolean;
  username: string;
}

interface BulkVerificationStatusResponse {
  job_id: string;
  created_at: string;
  finished_at: string;
  total_records: number;
  total_processed: number;
  summary: Summary;
  job_status: 'Running' | 'Completed';
}

interface Summary {
  total_safe: number;
  total_invalid: number;
  total_risky: number;
  total_unknown: number;
}

interface BulkVerificationResultsResponse {
  results: EmailCheckOutput[];
}

interface ReacherConfig {
  host?: string;
  timeoutMs?: number;
  apiKey?: string;
  headerSecret?: string;
  smtpConfig?: SMTPConfig;
  smtpTimeoutSeconds?: number;
  smtpRetries?: number;
  microsoft365UseApi?: boolean;
  gmailUseApi?: boolean;
  yahooUseApi?: boolean;
  hotmailUseHeadless?: string;
}

interface SMTPConfig {
  fromEmail?: string;
  helloName?: string;
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
}

interface ValidationOptions {
  fromEmail: string;
}

function extractWaitTime(errorMessage?: string): number {
  const DEFAULT_WAIT_TIME = 10000; // 10 sec
  const match = /(\d+(?:\.\d+)?)\s*s/.exec(errorMessage ?? '');
  return match ? Math.ceil(parseFloat(match[1]) * 1000) : DEFAULT_WAIT_TIME;
}

async function reacherRequestWithRetry<T>(callback: () => Promise<T>) {
  try {
    return await callback();
  } catch (error) {
    const err = error as AxiosError;
    const status = err.response?.status;
    const message = (err.response?.data as { error?: string })?.error ?? '';
    const shouldRetry = status === 429 && message.includes('wait');
    if (!shouldRetry) throw err;

    const waitTime = extractWaitTime(message);
    console.info(
      `[ReacherClient.reacherRequestWithRetry]: Rate limited. Waiting ${waitTime}ms before retrying`
    );
    await new Promise((resolve) => {
      setTimeout(() => resolve(true), waitTime);
    });

    return await callback();
  }
}

export default class ReacherClient {
  static readonly SINGLE_VERIFICATION_PATH = '/v1/check_email';

  static readonly BULK_VERIFICATION_PATH = '/v0/bulk';

  private readonly api: AxiosInstance;

  private readonly smtpConfig: {
    from_email?: string;
    hello_name?: string;
    proxy?: {
      host: string;
      port: number;
      username?: string;
      password?: string;
    };
  } = {};

  private readonly additionalSettings: {
    microsoft365_use_api?: boolean;
    gmail_use_api?: boolean;
    yahoo_use_api?: boolean;
    hotmail_use_headless?: string;
    retries?: number;
    smtp_timeout?: {
      secs: number;
      nanos: number;
    };
  } = {};

  constructor(
    config: ReacherConfig,
    private readonly rateLimiter: IRateLimiter,
    private readonly logger: Logger
  ) {
    this.api = axios.create({
      baseURL: config.host
    });

    if (config.timeoutMs) {
      this.api.defaults.timeout = config.timeoutMs;
    }
    if (config.apiKey) {
      this.api.defaults.headers.common.Authorization = config.apiKey;
    }
    if (config.headerSecret) {
      this.api.defaults.headers.common['x-reacher-secret'] =
        config.headerSecret;
    }
    if (config.microsoft365UseApi) {
      this.additionalSettings.microsoft365_use_api = config.microsoft365UseApi;
    }
    if (config.gmailUseApi) {
      this.additionalSettings.gmail_use_api = config.gmailUseApi;
    }
    if (config.yahooUseApi) {
      this.additionalSettings.yahoo_use_api = config.yahooUseApi;
    }
    if (config.hotmailUseHeadless) {
      this.additionalSettings.hotmail_use_headless = config.hotmailUseHeadless;
    }
    if (config.smtpRetries) {
      this.additionalSettings.retries = config.smtpRetries;
    }
    if (config.smtpTimeoutSeconds) {
      this.additionalSettings.smtp_timeout = {
        secs: config.smtpTimeoutSeconds,
        nanos: 0
      };
    }
    if (config.smtpConfig?.fromEmail) {
      this.smtpConfig.from_email = config.smtpConfig?.fromEmail;
    }
    if (config.smtpConfig?.helloName) {
      this.smtpConfig.hello_name = config.smtpConfig?.helloName;
    }
    if (config.smtpConfig?.proxy) {
      this.smtpConfig.proxy = {
        host: config.smtpConfig.proxy.host,
        port: config.smtpConfig.proxy.port
      };
      if (config.smtpConfig.proxy.username) {
        this.smtpConfig.proxy.username = config.smtpConfig.proxy.username;
      }
      if (config.smtpConfig.proxy.password) {
        this.smtpConfig.proxy.password = config.smtpConfig.proxy.password;
      }
    }
  }

  async checkSingleEmail(
    email: string,
    abortSignal?: AbortSignal,
    validationOptions?: ValidationOptions
  ): Promise<EmailCheckOutput> {
    try {
      const { data } = await this.rateLimiter.throttleRequests(() =>
        reacherRequestWithRetry(() =>
          this.api.post<EmailCheckOutput>(
            ReacherClient.SINGLE_VERIFICATION_PATH,
            {
              to_email: email,
              ...this.additionalSettings,
              ...this.smtpConfig,
              from_email: validationOptions
                ? validationOptions.fromEmail
                : this.smtpConfig.from_email
            },
            { signal: abortSignal }
          )
        )
      );
      return { ...data, input: email };
    } catch (error) {
      logError(error, `[Reacher:checkSingleEmail:${email}]`, this.logger);
      throw error;
    }
  }

  async createBulkVerificationJob(
    emails: string[]
  ): Promise<BulkSubmitResponse> {
    try {
      const { data } = await this.api.post<BulkSubmitResponse>(
        ReacherClient.BULK_VERIFICATION_PATH,
        {
          input_type: 'array',
          input: emails,
          ...this.smtpConfig,
          ...this.additionalSettings
        }
      );

      return data;
    } catch (error) {
      logError(error, '[Reacher:createBulkVerificationJob]', this.logger);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<BulkVerificationStatusResponse> {
    try {
      const { data } = await this.api.get<BulkVerificationStatusResponse>(
        `${ReacherClient.BULK_VERIFICATION_PATH}/${jobId}`
      );

      return data;
    } catch (error) {
      logError(error, '[Reacher:getJobStatus]', this.logger);
      throw error;
    }
  }

  async getResults(jobId: string): Promise<BulkVerificationResultsResponse> {
    try {
      const { data } = await this.api.get<BulkVerificationResultsResponse>(
        `${ReacherClient.BULK_VERIFICATION_PATH}/${jobId}/results`
      );

      return data;
    } catch (error) {
      logError(error, '[Reacher:getResults]', this.logger);
      throw error;
    }
  }
}
