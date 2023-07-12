import { REGEX_LIST_ID } from '../../utils/constants';
import { checkDomainStatus } from '../../utils/helpers/domainHelpers';
import { extractNameAndEmail, extractNameAndEmailFromBody } from './helpers';

import {
  ContactLead,
  EmailSendersRecipients,
  Message,
  MESSAGING_FIELDS,
  MessageField,
  Contact,
  Person,
  PointOfContact,
  ContactTag,
  IGNORED_MESSAGE_TAGS
} from './types';
import { TaggingEngine } from '../tagging/types';
import { getSpecificHeader } from '../../utils/helpers/emailHeaderHelpers';

export default class EmailMessage {
  private static IGNORED_MESSAGE_TAGS = IGNORED_MESSAGE_TAGS;

  readonly date: string | null;

  readonly listId: string;

  readonly messageId: string;

  readonly references: string[];

  /**
   * Creates an instance of EmailMessage.
   *
   * @param {Object} redisClientForNormalMode - The Redis client used for normal mode.
   * @param {String} userEmail - The email address of the user.
   * @param {String} sequentialId - The sequential ID of the message.
   * @param {Object} header - The header of the message.
   * @param {Object} body - The body of the message.
   * @param {String} folder - the path of the folder where the email is located
   */
  constructor(
    private readonly taggingEngine: TaggingEngine,
    private readonly redisClientForNormalMode: any,
    private readonly userEmail: string,
    private readonly header: any,
    private readonly body: any,
    private readonly folderPath: string
  ) {
    const date = this.getDate();

    this.date = date !== null ? date : 'UNKOWN';
    this.listId = this.getListId();
    this.messageId = this.getMessageId();
    this.references = this.getReferences();
  }

  /**
   * Gets the list of references from  the email header if the message is in a conversation, otherwise returns an empty array.
   * @returns
   */
  private getReferences(): string[] {
    const references = getSpecificHeader(this.header, ['references']);

    if (references) {
      return references[0].split(' ').filter((ref: string) => ref !== ''); // references in header comes as ["<r1> <r2> <r3> ..."]
    }

    return [];
  }

  /**
   * Gets the `list-id` header field if the email is in a mailing list otherwise returns an empty string.
   * @returns
   */
  private getListId(): string {
    const listId = getSpecificHeader(this.header, ['list-id']);

    if (listId === null) {
      return '';
    }

    const matchId = listId ? listId[0].match(REGEX_LIST_ID) : null;
    return matchId ? matchId[0] : '';
  }

  /**
   * Returns the date from the header object, or null if it is not present or not a valid date
   * @returns The UTC formatted date string or null if it is not present or not a valid date.
   */
  private getDate() {
    if (!this.header.date) {
      return null;
    }
    const dateStr = new Date(this.header.date[0]).toUTCString();
    return dateStr !== 'Invalid Date' ? dateStr : null;
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
      conversation: this.references.length > 0
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
            name: validContact.name,
            email: validContact.email.address,
            url: '',
            image: '',
            address: '',
            alternateNames: [],
            sameAs: [],
            givenName: validContact.name,
            familyName: '',
            jobTitle: '',
            identifiers: [validContact.email.identifier]
          };

          const pointOfContact: PointOfContact = {
            name: validContact.name ?? '',
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
            .getTags({ header: this.header, email: validContact.email })
            .filter(
              (t: ContactTag) =>
                !EmailMessage.IGNORED_MESSAGE_TAGS.includes(t.name)
            )
            .map((tag: ContactTag) => ({
              name: tag.name,
              reachable: tag.reachable,
              source: tag.source
            }));

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
