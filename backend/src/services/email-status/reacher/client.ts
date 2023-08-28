import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
import { handleAxiosError } from '../../../utils/axios';

interface BulkSubmitResponse {
  job_id: string;
}

interface CheckError {
  type: string;
  message: string;
}

export interface EmailCheckOutput {
  input: string;
  is_reachable: 'invalid' | 'unknown' | 'safe' | 'risky';
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
}

interface SMTPConfig {
  from?: string;
  helloName?: string;
  proxy?: {
    host: string;
    port: number;
  };
}

export default class ReacherClient {
  private static readonly SINGLE_VERIFICATION_PATH = '/v0/check_email';

  private static readonly BULK_VERIFICATION_PATH = '/v0/bulk';

  private readonly api: AxiosInstance;

  private readonly smtpConfig?: SMTPConfig;

  constructor(private readonly logger: Logger, config: ReacherConfig) {
    this.api = axios.create({
      baseURL: config.host
    });
    this.smtpConfig = config.smtpConfig;
    if (config.apiKey) {
      this.api.defaults.headers.common.Authorization = config.apiKey;
    }
    if (config.headerSecret) {
      this.api.defaults.headers.common['x-reacher-secret'] =
        config.headerSecret;
    }
  }

  async checkSingleEmail(email: string, abortSignal?: AbortSignal) {
    try {
      // We're using any here to be able to dynamically add attributes to the request body
      // If we use optional chaining, Axios will serialize undefined values in the payload which we don't want to happen
      const requestBody: any = {
        to_email: email
      };

      if (this.smtpConfig?.from) {
        requestBody.from_email = this.smtpConfig?.from;
      }
      if (this.smtpConfig?.helloName) {
        requestBody.hello_name = this.smtpConfig?.helloName;
      }
      if (this.smtpConfig?.proxy) {
        requestBody.proxy = this.smtpConfig?.proxy;
      }

      const { data } = await this.api.post<EmailCheckOutput>(
        ReacherClient.SINGLE_VERIFICATION_PATH,
        requestBody,
        { signal: abortSignal, timeout: 5000 }
      );
      return { data, error: null };
    } catch (error) {
      this.logger.error('Failed checking single email', error);
      if (axios.isAxiosError(error)) {
        return { ...handleAxiosError(error), data: null };
      }
      throw error;
    }
  }

  async createBulkVerificationJob(
    emails: string[]
  ): Promise<
    { data: BulkSubmitResponse; error: null } | { data: null; error: Error }
  > {
    // We're using any here to be able to dynamically add attributes to the request body
    // If we use optional chaining, Axios will serialize undefined values in the payload which we don't want to happen
    const requestBody: any = {
      input_type: 'array',
      input: emails
    };

    if (this.smtpConfig?.from) {
      requestBody.from_email = this.smtpConfig?.from;
    }
    if (this.smtpConfig?.helloName) {
      requestBody.hello_name = this.smtpConfig?.helloName;
    }
    if (this.smtpConfig?.proxy) {
      requestBody.proxy = this.smtpConfig?.proxy;
    }

    try {
      const { data } = await this.api.post<BulkSubmitResponse>(
        ReacherClient.BULK_VERIFICATION_PATH,
        { data: requestBody }
      );

      return { data, error: null };
    } catch (error) {
      this.logger.error('Failed creating bulk verification job', error);
      if (axios.isAxiosError(error)) {
        return { ...handleAxiosError(error), data: null };
      }
      throw error;
    }
  }

  async getJobStatus(jobId: string) {
    try {
      const { data } = await this.api.get<BulkVerificationStatusResponse>(
        `${ReacherClient.BULK_VERIFICATION_PATH}/${jobId}`
      );

      return { data, error: null };
    } catch (error) {
      this.logger.error('Failed retrieving job status', error);
      if (axios.isAxiosError(error)) {
        return { ...handleAxiosError(error), data: null };
      }
      throw error;
    }
  }

  async getResults(jobId: string) {
    try {
      const { data } = await this.api.get<BulkVerificationResultsResponse>(
        `${ReacherClient.BULK_VERIFICATION_PATH}/${jobId}/results`
      );

      return { data, error: null };
    } catch (error) {
      this.logger.error('Failed retrieving job results', error);
      if (axios.isAxiosError(error)) {
        return { ...handleAxiosError(error), data: null };
      }
      throw error;
    }
  }
}
