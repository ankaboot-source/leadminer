import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
import { logError } from '../../../utils/axios';
import { IRateLimiter } from '../../rate-limiter/RateLimiter';
import { TIMEOUT } from '../constants';

export default class MailerCheckClient {
  private static readonly baseURL = 'https://app.mailercheck.com/api/';

  private readonly api: AxiosInstance;

  constructor(
    config: Config,
    private readonly rateLimiter: IRateLimiter,
    private readonly logger: Logger
  ) {
    this.api = axios.create({
      baseURL: MailerCheckClient.baseURL,
      headers: {
        Authorization: `Bearer ${config.apiToken}`
      },
      timeout: TIMEOUT
    });
  }

  async verifyEmail(email: string): Promise<MailerCheckResult> {
    try {
      const { data } = await this.rateLimiter.throttleRequests(() =>
        this.api.post<{ status: MailerCheckResult }>('check/single', {
          email
        })
      );
      return data.status;
    } catch (error) {
      logError(error, '[MailerCheck:verifyEmail]', this.logger);
      throw error;
    }
  }

  async createList({ emails, name }: CreateListInput): Promise<number> {
    try {
      const {
        data: {
          data: { id }
        }
      } = await this.rateLimiter.throttleRequests(() =>
        this.api.post<{ data: ListResponse }>('lists', {
          emails,
          name
        })
      );
      return id;
    } catch (error) {
      logError(error, '[MailerCheck:createList]', this.logger);
      throw error;
    }
  }

  async startListVerification(listId: number): Promise<void> {
    try {
      await this.rateLimiter.throttleRequests(() =>
        this.api.put(`lists/${listId}/verify`)
      );
    } catch (error) {
      logError(error, '[MailerCheck:startListVerification]', this.logger);
      throw error;
    }
  }

  async getListStatus(listId: number): Promise<StatusName> {
    try {
      const { data } = await this.rateLimiter.throttleRequests(() =>
        this.api.get<ListResponse>(`lists/${listId}`)
      );
      return data.status.name;
    } catch (error) {
      logError(error, '[MailerCheck:getListStatus]', this.logger);
      throw error;
    }
  }

  async getListResults(
    listId: number,
    limit = 100,
    page = 1
  ): Promise<{
    hasMorePages: boolean;
    emails: { address: string; result: MailerCheckResult }[];
  }> {
    try {
      const params = {
        limit,
        page
      };
      const { data } = await this.rateLimiter.throttleRequests(() =>
        this.api.get<ListVerificationResult>(`lists/${listId}/results`, {
          params
        })
      );

      return {
        hasMorePages: data.has_more_pages,
        emails: data.emails.map(({ address, result }) => ({ address, result }))
      };
    } catch (error) {
      logError(error, '[MailerCheck:getListResults]', this.logger);
      throw error;
    }
  }
}

export type MailerCheckResult =
  | 'valid'
  | 'catch_all'
  | 'mailbox_full'
  | 'role'
  | 'past_delivery_issues'
  | 'unknown'
  | 'syntax_error'
  | 'typo'
  | 'mailbox_not_found'
  | 'disposable'
  | 'blocked'
  | 'error';

interface Config {
  apiToken: string;
}

interface CreateListInput {
  emails: string[];
  name: string;
}

export interface ListVerificationResult {
  total: number;
  page: number;
  limit: number;
  has_more_pages: boolean;
  last_page: number;
  result: string;
  emails: Email[];
}

export interface Email {
  id: number;
  address: string;
  line: number;
  checked: number;
  result: MailerCheckResult;
  created_at: Date;
  updated_at: Date;
}

interface ListResponse {
  id: number;
  account_id: number;
  user_id: number;
  source: string;
  name: string;
  type: string;
  count: number;
  updated_at: Date;
  created_at: Date;
  status: Status;
  statistics: Statistics;
}

type StatusName = 'done' | 'not_started' | 'processing';

interface Status {
  name: StatusName;
  count: number | null;
}

interface Statistics {
  valid: number;
  syntax_error: number;
  typo: number;
  mailbox_not_found: number;
  catch_all: number;
  mailbox_full: number;
  disposable: number;
  role: number;
  past_delivery_issues: number;
  blocked: number;
  error: number;
  unknown: number;
}
