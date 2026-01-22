import { Logger } from 'winston';
import axios, { AxiosInstance } from 'axios';
import assert from 'node:assert';
import { logError } from '../../../utils/axios';
import { IRateLimiter } from '../../rate-limiter';
import TIMEOUT from '../constants';

/**
 * Configuration options for ZerobounceClient.
 * @url https://api.zerobounce.net/v2/ Or https://api-us.zerobounce.net/v2/
 * @apiToken Zerobounce api token
 * @singleValidationPerMinute number of maximum requests per minute
 * @batchValidationPerMinute number of maximum requests per minute
 */
interface Config {
  url?: string;
  apiToken: string;
}

/**
 * Possible email validation statuses returned by the Zerobounce API.
 */
export type ZerobounceStatusResult =
  | 'valid'
  | 'invalid'
  | 'catch-all'
  | 'unknown'
  | 'spamtrap'
  | 'abuse'
  | 'do_not_mail';

/**
 * Possible email sub-statuses returned by the Zerobounce API.
 */
type EmailSubStatus =
  | 'alternate'
  | 'antispam_system'
  | 'greylisted'
  | 'mail_server_temporary_error'
  | 'forcible_disconnect'
  | 'mail_server_did_not_respond'
  | 'timeout_exceeded'
  | 'failed_smtp_connection'
  | 'mailbox_quota_exceeded'
  | 'exception_occurred'
  | 'possible_trap'
  | 'role_based'
  | 'global_suppression'
  | 'mailbox_not_found'
  | 'no_dns_entries'
  | 'failed_syntax_check'
  | 'possible_typo'
  | 'unroutable_ip_address'
  | 'leading_period_removed'
  | 'does_not_accept_mail'
  | 'alias_address'
  | 'role_based_catch_all'
  | 'disposable'
  | 'toxic'
  | '';

/**
 * The result of an email validation request to the Zerobounce API.
 */
export interface ZerobounceEmailValidationResult {
  address: string;
  status: ZerobounceStatusResult;
  sub_status: EmailSubStatus;
  account: string | null;
  domain: string | null;
  did_you_mean: string | null;
  domain_age_days: string | null;
  free_email: boolean;
  mx_found: string;
  mx_record: string | null;
  smtp_provider: string | null;
  firstname: string | null;
  lastname: string | null;
  gender: string | null;
  city: string | null;
  region: string | null;
  zipcode: string | null;
  country: string | null;
  processed_at: string;
  error?: string;
}

/**
 * An email object used for email validation requests to Zerobounce API.
 */
interface EmailObject {
  email_address: string;
  ip_address: string | null;
}

/**
 * The response from a batch email validation request to Zerobounce API.
 */
interface EmailValidationResponse {
  email_batch: ZerobounceEmailValidationResult[] | [];
  errors?: { email_address: string; error: string }[];
}

export default class ZerobounceClient {
  private static readonly baseURL = 'https://api.zerobounce.net/v2/';

  static readonly BATCH_VALIDATION_LENGTH = 200;

  static readonly BATCH_VALIDATION_PER_MINUTE = 5;

  static readonly SINGLE_VALIDATION_PER_10_SECONDS = 50000;

  private readonly api: AxiosInstance;

  /**
   * @param config - The configuration options for the client.
   * @param logger - The logger instance to use for logging errors.
   */
  constructor(
    private readonly config: Config,
    readonly singleValidationRateLimiter: IRateLimiter,
    readonly batchValidationRateLimiter: IRateLimiter,
    private readonly logger: Logger
  ) {
    this.api = axios.create({
      baseURL: config.url ?? ZerobounceClient.baseURL,
      timeout: TIMEOUT
    });
  }

  /**
   * Verifies the validity of a single email address.
   * @param emailObject - Email object contains { email_address, ip_address }
   * @returns The email validation result.
   */
  public async verifyEmail({
    email_address: email,
    ip_address: ipAddress
  }: EmailObject): Promise<ZerobounceEmailValidationResult> {
    try {
      const response = await this.singleValidationRateLimiter.throttleRequests(
        () =>
          this.api.get<ZerobounceEmailValidationResult>('validate', {
            params: {
              email,
              ip_address: ipAddress ?? '',
              api_key: this.config.apiToken
            }
          })
      );
      return response.data;
    } catch (error) {
      logError(
        error,
        `[${this.constructor.name}:verifyEmail:${email}]`,
        this.logger
      );
      throw error;
    }
  }

  /**
   * Verifies the validity of a batch of email addresses using the Zerobounce API.
   * @param emailBatch - array of email objects to validate.
   * @param timeout - optional timeout in milliseconds for the API request.
   * @returns email validation response.
   * @throws If the email batch size exceeds the maximum limit.
   */
  public async verifyEmailBulk(
    emailBatch: EmailObject[],
    timeout?: number
  ): Promise<EmailValidationResponse> {
    try {
      assert(
        emailBatch.length <= ZerobounceClient.BATCH_VALIDATION_LENGTH,
        `Maximum emails to validate per request is ${ZerobounceClient.BATCH_VALIDATION_LENGTH}`
      );
      const response = await this.batchValidationRateLimiter.throttleRequests(
        () =>
          this.api.post<EmailValidationResponse>('validatebatch', {
            body: {
              timeout,
              email_batch: emailBatch,
              api_key: this.config.apiToken
            }
          })
      );
      return response.data;
    } catch (error) {
      logError(
        error,
        `[${this.constructor.name}:verifyEmailBulk]`,
        this.logger
      );
      throw error;
    }
  }
}
