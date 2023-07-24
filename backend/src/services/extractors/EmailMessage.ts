import { Redis } from 'ioredis';
import { REACHABILITY, REGEX_LIST_ID } from '../../utils/constants';
import { checkDomainStatus } from '../../utils/helpers/domainHelpers';
import { extractNameAndEmail, extractNameAndEmailFromBody } from './helpers';

import { differenceInDays } from '../../utils/helpers/date';
import { getSpecificHeader } from '../../utils/helpers/emailHeaderHelpers';
import {
  EmailStatusVerifier,
  Status
} from '../email-status/EmailStatusVerifier';
import { TaggingEngine } from '../tagging/types';
import {
  Contact,
  ContactLead,
  ContactTag,
  EmailSendersRecipients,
  IGNORED_MESSAGE_TAGS,
  MESSAGING_FIELDS,
  Message,
  MessageField,
  Person,
  PointOfContact
} from './types';

export default class EmailMessage {
  private static IGNORED_MESSAGE_TAGS = IGNORED_MESSAGE_TAGS;

  private static MAX_RECENCY_TO_SKIP_EMAIL_STATUS_CHECK_IN_DAYS = 100;

  readonly messageId: string;

  readonly date: string | undefined;

  readonly listId: string | undefined;

  readonly references: string[] | undefined;

  /**
   * Creates an instance of EmailMessage.
   *
   * @param redisClientForNormalMode - The Redis client used for normal mode.
   * @param userEmail - The email address of the user.
   * @param sequentialId - The sequential ID of the message.
   * @param header - The header of the message.
   * @param body - The body of the message.
   * @param folderPath - the path of the folder where the email is located
   */
  constructor(
    private readonly taggingEngine: TaggingEngine,
    private readonly emailVerifier: EmailStatusVerifier,
    private readonly redisClientForNormalMode: Redis,
    private readonly userEmail: string,
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
        const [domainIsValid, domainType] = await checkDomainStatus(
          this.redisClientForNormalMode,
          contact.email.domain.toLowerCase()
        );

        const validContact = {
          name: contact.name,
          email: {
            address: contact.email.address,
            identifier: contact.email.identifier,
            domain: contact.email.domain,
            domainType
          },
          source: contact.source,
          sourceField: contact.sourceField
        };

        if (domainIsValid) {
          const person: Person = {
            status: Status.UNKNOWN,
            name: validContact.name,
            email: validContact.email.address,
            givenName: validContact.name,
            identifiers: [validContact.email.identifier]
          };

          const pointOfContact: PointOfContact = {
            name: validContact.name,
            to: validContact.sourceField === 'to',
            cc: validContact.sourceField === 'cc',
            bcc: validContact.sourceField === 'bcc',
            body: validContact.sourceField === 'body',
            from: validContact.sourceField === 'from',
            replyTo:
              validContact.sourceField === 'reply-to' ||
              validContact.sourceField === 'reply_to'
          };

          const tags = this.taggingEngine
            .getTags({
              header: this.header,
              email: validContact.email,
              field: validContact.sourceField
            })
            .reduce((result: ContactTag[], tag) => {
              if (!EmailMessage.IGNORED_MESSAGE_TAGS.includes(tag.name)) {
                result.push({
                  name: tag.name,
                  reachable: tag.reachable,
                  source: tag.source
                });
              }
              return result;
            }, []);

          if (tags.some((t) => t.reachable === REACHABILITY.DIRECT_PERSON)) {
            if (
              validContact.sourceField === 'from' &&
              this.date &&
              differenceInDays(new Date(), new Date(Date.parse(this.date))) <=
                EmailMessage.MAX_RECENCY_TO_SKIP_EMAIL_STATUS_CHECK_IN_DAYS
            )
              person.status = Status.VALID;
            else {
              person.status = (
                await this.emailVerifier.verify(person.email)
              ).status;
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
  async getContacts(): Promise<Contact> {
    const contacts: Contact = {
      message: this.getMessageDetails(),
      persons: await this.extractContacts()
    };

    return contacts;
  }
}
