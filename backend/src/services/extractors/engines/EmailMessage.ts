import { Redis } from 'ioredis';
import { REACHABILITY, REGEX_LIST_ID } from '../../../utils/constants';
import { extractNameAndEmail, extractNameAndEmailFromBody } from '../helpers';

import { Message, Person, PointOfContact } from '../../../db/types';
import { differenceInDays } from '../../../utils/helpers/date';
import { getSpecificHeader } from '../../../utils/helpers/emailHeaderHelpers';
import CatchAllDomainsCache from '../../cache/CatchAllDomainsCache';
import EmailStatusCache from '../../cache/EmailStatusCache';
import { Status } from '../../email-status/EmailStatusVerifier';
import { TaggingEngine } from '../../tagging/types';

const IGNORED_MESSAGE_TAGS: ReadonlyArray<string> = [
  'transactional',
  'no-reply'
] as const;

const MESSAGING_FIELDS = [
  'to',
  'from',
  'cc',
  'bcc',
  'reply-to',
  'reply_to',
  'list-post'
] as const;

type MessageField = (typeof MESSAGING_FIELDS)[number];

interface EmailSendersRecipients {
  to: MessageField;
  from: MessageField;
  cc: MessageField;
  bcc: MessageField;
  'reply-to'?: MessageField;
  reply_to?: MessageField;
  'list-post'?: MessageField;
}

interface ContactLead {
  name?: string;
  email: {
    address: string;
    plusAddress?: string;
    identifier: string;
    domain: string;
    domainType?: string;
  };
  sourceField: MessageField | 'body';
  source: 'header' | 'body';
}

interface ContactTag {
  name: string;
  reachable: REACHABILITY;
  source: string;
}

export type DomainStatusVerificationFunction = (
  redisClient: Redis,
  domain: string
) => Promise<
  [boolean, 'provider' | 'disposable' | 'custom' | 'invalid', string]
>;

export interface ExtractedContacts {
  type: 'email';
  message: Message;
  persons: {
    person: Person;
    pointOfContact: PointOfContact;
    tags: ContactTag[];
  }[];
}

export interface EmailFormat {
  header: unknown;
  body: unknown;
  folderPath: string;
}

export default class EmailMessage {
  static readonly IGNORED_MESSAGE_TAGS = IGNORED_MESSAGE_TAGS;

  static readonly MAX_RECENCY_TO_SKIP_EMAIL_STATUS_CHECK_IN_DAYS = 100;

  readonly messageId: string;

  readonly date: string | undefined;

  readonly listId: string | undefined;

  readonly references: string[] | undefined;

  /**
   * Creates an instance of EmailMessage.
   *
   * @param taggingEngine - The tagging engine responsible for categorizing the message.
   * @param redisClientForNormalMode - The Redis client used for normal mode.
   * @param emailStatusCache - The queue used for email verification.
   * @param domainStatusVerification - The function that does domain status verification.
   * @param userEmail - The email address of the user.
   * @param userId - The unique identifier of the user.
   * @param header - The header of the message.
   * @param body - The body of the message.
   * @param folderPath - The path of the folder where the email is located.
   */
  constructor(
    private readonly taggingEngine: TaggingEngine,
    private readonly redisClientForNormalMode: Redis,
    private readonly emailStatusCache: EmailStatusCache,
    private readonly catchAllDomainsCache: CatchAllDomainsCache,
    private readonly domainStatusVerification: DomainStatusVerificationFunction,
    private readonly userEmail: string,
    private readonly userId: string,
    private readonly header: any,
    private readonly body: any,
    private readonly folderPath: string
  ) {
    const date = this.getDate();

    this.date = date !== null ? date : undefined;
    this.listId = this.getListId();
    this.messageId = this.getMessageId();
    this.references = this.getReferences();
  }

  /**
   * Gets the list of references from  the email header if the message is in a conversation, otherwise returns an empty array.
   * @returns
   */
  private getReferences(): string[] | undefined {
    const references = getSpecificHeader(this.header, ['references']);

    if (references) {
      return references[0].split(' ').filter((ref: string) => ref !== ''); // references in header comes as ["<r1> <r2> <r3> ..."]
    }

    return undefined;
  }

  /**
   * Gets the `list-id` header field if the email is in a mailing list otherwise returns an empty string.
   * @returns
   */
  private getListId(): string | undefined {
    const listId = getSpecificHeader(this.header, ['list-id']);

    if (listId === undefined) {
      return undefined;
    }

    const matchId = listId ? listId[0].match(REGEX_LIST_ID) : undefined;
    return matchId ? matchId[0] : undefined;
  }

  /**
   * Returns the date from the header object, or null if it is not present or not a valid date
   * @returns The UTC formatted date string or null if it is not present or not a valid date.
   */
  private getDate(): string | undefined {
    if (!this.header.date) {
      return undefined;
    }
    const dateStr = new Date(this.header.date[0]).toUTCString();
    return dateStr !== 'Invalid Date' ? dateStr : undefined;
  }

  /**
   * Extracts messaging fields from the email header.
   * @returns
   */
  private getSendersRecipientsFields(): EmailSendersRecipients {
    const filteredFields = Object.entries(this.header)
      .map(([field, emailString]) => [field.toLocaleLowerCase(), emailString])
      .filter(([field]) => MESSAGING_FIELDS.includes(field as MessageField));

    return Object.fromEntries(filteredFields);
  }

  /**
   * Gets the `message-id` header field of the email.
   * @returns
   */
  private getMessageId(): string {
    return this.header['message-id'][0];
  }

  /**
   * Retrieves details about the message.
   * @returns An object containing various details of the message.
   */
  getMessageDetails(): Message {
    return {
      channel: 'imap',
      date: this.date as string,
      listId: this.listId,
      folderPath: this.folderPath,
      messageId: this.messageId,
      references: this.references,
      conversation: this.references !== undefined
    };
  }

  /**
   * Extracts contact from the email header.
   * @returns A promise that resolves to an array of contact leads.
   */
  private async extractContactsFromEmailHeader() {
    // Get all senders and recipients fields from the email with values.
    const sendersRecipientsFields = this.getSendersRecipientsFields();
    // Extract emails from all available fields in parallel.
    const contacts: ContactLead[] = [];

    await Promise.all(
      Object.entries(sendersRecipientsFields).map(([field, emailsString]) => {
        const extractedEmails = extractNameAndEmail(emailsString[0]);
        extractedEmails.forEach((email) => {
          if (email.address !== this.userEmail) {
            contacts.push({
              name: email.name,
              email: {
                address: email.address,
                plusAddress: email.plusAddress,
                identifier: email.identifier,
                domain: email.domain
              },
              source: 'header',
              sourceField: field as MessageField
            });
          }
        });
        return Promise.resolve();
      })
    );

    return contacts;
  }

  /**
   * Extracts contacts from the email body.
   * @returns An array of contact leads.
   */
  private extractContactsFromEmailBody() {
    const extractedEmails = extractNameAndEmailFromBody(this.body);
    // Map the extracted emails to contact leads.
    const contacts: ContactLead[] = [];

    for (const email of extractedEmails) {
      if (email && email.address !== this.userEmail) {
        contacts.push({
          name: email.name,
          email: {
            address: email.address,
            identifier: email.identifier,
            domain: email.domain
          },
          source: 'body',
          sourceField: 'body'
        } as ContactLead);
      }
    }

    return contacts;
  }

  /**
   * Extracts contacts from the email header and body, validates their email domains,
   * @returns An array of objects containing person, point of contact, and tags.
   */
  private async extractContacts(): Promise<
    {
      person: Person;
      pointOfContact: PointOfContact;
      tags: ContactTag[];
    }[]
  > {
    const headerContacts = await this.extractContactsFromEmailHeader();
    const bodyContacts =
      this.body !== '' ? this.extractContactsFromEmailBody() : [];

    const validatedContacts: {
      person: Person;
      pointOfContact: PointOfContact;
      tags: ContactTag[];
    }[] = [];

    await Promise.all(
      [...headerContacts, ...bodyContacts].map(async (contact: ContactLead) => {
        const [domainIsValid, domainType] = await this.domainStatusVerification(
          this.redisClientForNormalMode,
          contact.email.domain.toLowerCase()
        );

        const validContact = {
          name: contact.name,
          email: {
            address: contact.email.address,
            plusAddress: contact.email.plusAddress,
            identifier: contact.email.identifier,
            domain: contact.email.domain,
            domainType
          },
          source: contact.source,
          sourceField: contact.sourceField
        };

        if (domainIsValid) {
          const person: Person = {
            name: validContact.name,
            email: validContact.email.address,
            identifiers: [validContact.email.identifier],
            source: this.userEmail
          };

          const pointOfContact: PointOfContact = {
            name: validContact.name,
            plusAddress: validContact.email.plusAddress,
            to: validContact.sourceField === 'to',
            cc: validContact.sourceField === 'cc',
            bcc: validContact.sourceField === 'bcc',
            body: validContact.sourceField === 'body',
            from: validContact.sourceField === 'from',
            replyTo:
              validContact.sourceField === 'reply-to' ||
              validContact.sourceField === 'reply_to'
          };

          const tags = this.taggingEngine.getTags({
            header: this.header,
            email: validContact.email,
            field: validContact.sourceField
          });

          // Eliminate unwanted contacts associated with tags listed in IGNORED_MESSAGE_TAGS
          if (
            tags.some((t) => EmailMessage.IGNORED_MESSAGE_TAGS.includes(t.name))
          ) {
            return;
          }

          if (tags.some((t) => t.reachable === REACHABILITY.DIRECT_PERSON)) {
            if (
              validContact.sourceField === 'from' &&
              this.date &&
              differenceInDays(new Date(), new Date(Date.parse(this.date))) <=
                EmailMessage.MAX_RECENCY_TO_SKIP_EMAIL_STATUS_CHECK_IN_DAYS
            ) {
              await this.emailStatusCache.set(person.email, {
                email: person.email,
                status: Status.VALID,
                details: { isRecentFrom: true }
              });
            }
          } else {
            const catchAllDomainCache = await this.catchAllDomainsCache.exists(
              validContact.email.domain
            );
            if (catchAllDomainCache) {
              await this.emailStatusCache.set(person.email, {
                status: Status.UNKNOWN,
                email: person.email,
                details: { isCatchAll: true }
              });
            }
          }
          validatedContacts.push({
            person,
            pointOfContact,
            tags
          });
        }
      })
    );
    return validatedContacts;
  }

  /**
   * Extracts contacts from an email message, then returns the extracted data.
   * @returns
   */
  async getContacts(): Promise<ExtractedContacts> {
    const contacts = {
      type: 'email' as ExtractedContacts['type'],
      message: this.getMessageDetails(),
      persons: await this.extractContacts()
    };

    return contacts;
  }
}
