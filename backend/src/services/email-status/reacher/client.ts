import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';

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
  host: string;
  apiKey?: string;
  headerSecret?: string;
  smtpConfig?: SMTPConfig;
  timeoutMs: number;
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

export default class ReacherClient {
  private static readonly SINGLE_VERIFICATION_PATH = '/v0/check_email';

  private static readonly BULK_VERIFICATION_PATH = '/v0/bulk';

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

  constructor(private readonly logger: Logger, config: ReacherConfig) {
    this.api = axios.create({
      baseURL: config.host
    });
    this.api.defaults.timeout = config.timeoutMs;
    if (config.apiKey) {
      this.api.defaults.headers.common.Authorization = config.apiKey;
    }
    if (config.headerSecret) {
      this.api.defaults.headers.common['x-reacher-secret'] =
        config.headerSecret;
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
      const { data } = await this.api.post<EmailCheckOutput>(
        ReacherClient.SINGLE_VERIFICATION_PATH,
        {
          to_email: email,
          ...this.smtpConfig,
          from_email: validationOptions
            ? validationOptions.fromEmail
            : this.smtpConfig.from_email
        },
        { signal: abortSignal }
      );
      return data;
    } catch (error) {
      this.logError(error, `[Reacher:checkSingleEmail:${email}]`);
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
          ...this.smtpConfig
        }
      );

      return data;
    } catch (error) {
      this.logError(error, '[Reacher:createBulkVerificationJob]');
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
      this.logError(error, '[Reacher:getJobStatus]');
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
      this.logError(error, '[Reacher:getResults]');
      throw error;
    }
  }

  private logError(error: unknown, context: string) {
    if (axios.isAxiosError(error)) {
      const { stack, code, name, message } = error;
      this.logger.error(`${context}: ${message}`, { code, name, stack });
    } else {
      this.logger.error(`${context}: Something went wrong`, error);
    }
  }
}
