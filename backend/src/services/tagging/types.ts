import { REACHABILITY } from '../../utils/constants';
import { MessageField } from '../extractors/types';

export interface EmailMessageContent {
  header: any;
  body?: string;
}

export type DomainType = 'provider' | 'disposable' | 'custom' | 'invalid';

export interface TaggingCondition {
  checkCondition(emailMessageContent: EmailMessageContent): boolean;
}

export type TagSource =
  | 'refined'
  | 'refined#message_header'
  | 'refined#email_address';

export interface BasicTag {
  name: string;
  reachable: REACHABILITY;
  source: TagSource;
}

export interface HeaderTag {
  name: string;
  reachable: REACHABILITY;
  source: TagSource;
  fields: string[];
}

export interface Tag {
  tag: {
    name: string;
    reachable: REACHABILITY;
  };
  prerequisiteConditions?: TaggingCondition[];
  /**
   * This tag is applied to contacts extracted from the given fields if any of the rules are met
   */
  rules: {
    fields: MessageField[];
    conditions: TaggingCondition[];
  }[];
}

export interface TaggingEngine {
  readonly tags: Tag[];

  getTags(options: Record<string, any>): BasicTag[];
}
