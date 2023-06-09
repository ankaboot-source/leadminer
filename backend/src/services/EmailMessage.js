import { REGEX_LIST_ID } from '../utils/constants';
import { checkDomainStatus } from '../utils/helpers/domainHelpers';
import { getEmailTags } from '../utils/helpers/emailAddressHelpers';
import { getSpecificHeader } from '../utils/helpers/emailMessageHelpers';
import {
  extractNameAndEmail,
  extractNameAndEmailFromBody
} from '../utils/helpers/regexpHelpers';
import logger from '../utils/logger';
import messageTaggingRules from './tagging';
import { MESSAGING_FIELDS } from './tagging/types';

class EmailMessage {
  static #IGNORED_MESSAGE_TAGS = ['transactional', 'no-reply'];

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
    redisClientForNormalMode,
    userEmail,
    sequentialId,
    header,
    body,
    folder
  ) {
    this.redisClientForNormalMode = redisClientForNormalMode;
    this.userEmail = userEmail;
    this.sequentialId = sequentialId;
    this.header = header;
    this.body = body || '';
    this.folderPath = folder;

    this.messageId = this.#getMessageId();
    this.messagingFields = this.#getMessagingValues();
    this.date = this.#getDate();
    this.listId = this.#getListId();
    this.references = this.#getReferences();
    this.messageTags = this.#getMessageTags();
  }

  /**
   * Gets the list of references from  the email header if the message is in a conversation, otherwise returns an empty array.
   * @returns {string[]}
   */
  #getReferences() {
    const references = getSpecificHeader(this.header, ['references']);

    if (references) {
      return references[0].split(' ').filter((ref) => ref !== ''); // references in header comes as ["<r1> <r2> <r3> ..."]
    }

    return [];
  }

  /**
   * Gets the `list-id` header field if the email is in a mailing list otherwise returns an empty string.
   * @returns {string}
   */
  #getListId() {
    const listId = getSpecificHeader(this.header, ['list-id']);

    if (listId === null) {
      return '';
    }

    const matchId = listId ? listId[0].match(REGEX_LIST_ID) : null;
    return matchId ? matchId[0] : '';
  }

  /**
   * Returns the date from the header object, or null if it is not present or not a valid date
   * @returns {(string|null)} The UTC formatted date string or null if it is not present or not a valid date.
   */
  #getDate() {
    if (!this.header.date) {
      return null;
    }
    const dateStr = new Date(this.header.date[0]).toUTCString();
    return dateStr !== 'Invalid Date' ? dateStr : null;
  }

  /**
   * Extracts messaging fields from the email header.
   * @returns {object}
   */
  #getMessagingValues() {
    const messagingProps = {};

    for (const key of Object.keys(this.header)) {
      const lowerCaseKey = key.toLocaleLowerCase();
      if (MESSAGING_FIELDS.includes(lowerCaseKey)) {
        const [value] = this.header[`${key}`];
        messagingProps[`${lowerCaseKey}`] = value;
      }
    }

    return messagingProps;
  }

  /**
   * Gets the `message-id` header field of the email.
   * @returns {string}
   */
  #getMessageId() {
    return this.header['message-id'][0];
  }

  /**
   * Extracts message tags based on its header.
   * @returns { [{name: string, reachable: int, source: string}] | []}
   */
  #getMessageTags() {
    const tags = [];

    for (const {
      rulesToCheck,
      tag,
      requiredConditions
    } of messageTaggingRules) {
      // If the email message was already tagged differently, transactional tag no longer applies
      if (tag.name === 'transactional' && tags.length > 0) {
        return tags;
      }

      if (requiredConditions && requiredConditions.length > 0) {
        const isMissingRequiredCondition = requiredConditions.some(
          (c) => !c.checkCondition({ header: this.header })
        );

        if (isMissingRequiredCondition) {
          // eslint-disable-next-line no-continue
          continue;
        }
      }

      for (const { conditions, fields } of rulesToCheck) {
        if (
          conditions.some((condition) =>
            condition.checkCondition({ header: this.header })
          )
        ) {
          tags.push({ ...tag, source: 'refined', fields });
          break;
        }
      }
    }

    return tags;
  }

  /**
   * Extracts emails from the header and body of an email, then returns the extracted data.
   * @returns {Promise<{message: {object}, persons: {person: object, pointOfContact: object, tags: object[]}}[]>}
   */
  async extractEmailAddresses() {
    const extractedData = {
      message: {
        channel: 'imap',
        folderPath: this.folderPath,
        date: this.date,
        messageId: this.messageId,
        references: this.references,
        listId: this.listId,
        conversation: this.references.length > 0
      },
      persons: []
    };
    this.message = extractedData.message;

    const personsExtractedFromHeader = await Promise.allSettled(
      Object.keys(this.messagingFields).map(async (headerKey) => {
        try {
          const emails = extractNameAndEmail(
            this.messagingFields[`${headerKey}`]
          );
          const persons = await this.extractPersons(emails, headerKey);
          return persons;
        } catch (error) {
          logger.error(
            'Error while extracting names and emails',
            error,
            headerKey
          );
          return null;
        }
      })
    );

    extractedData.persons.push(
      ...personsExtractedFromHeader
        .flatMap((p) => p.value)
        .filter(
          ({ tags }) =>
            !tags.some(({ name }) =>
              EmailMessage.#IGNORED_MESSAGE_TAGS.includes(name)
            )
        )
    );

    if (this.body !== '') {
      const emails = extractNameAndEmailFromBody(this.body);
      extractedData.persons.push(
        ...(await this.extractPersons(emails, 'body', this.messageTags))
      );
    }

    return extractedData;
  }

  /**
   * personsExtractedFromHeader checks for email validity then returns a person objects with their tags and point of contact.
   * @param {Object[]} emails - an array of objects that contains the extracted email addresses and the names
   * @param {string} fieldName - the current extracted field name (eg: from , cc , to...)
   * @returns {Promise<Object[]>} An array of objects
   */
  async extractPersons(emails, fieldName) {
    const applicableMessageTags = this.messageTags.filter(({ fields }) =>
      fields.includes(fieldName)
    );

    const extractedPersons = await Promise.allSettled(
      emails.map(async (email) => {
        if (email.address === this.userEmail) {
          return null;
        }

        try {
          const [domainIsValid, domainType] = await checkDomainStatus(
            this.redisClientForNormalMode,
            email.domain.toLowerCase()
          );

          if (domainIsValid) {
            const emailTags = getEmailTags(email, domainType);

            const tags = [
              ...emailTags,
              ...applicableMessageTags.map(({ name, reachable }) => ({
                name,
                reachable,
                source: 'refined'
              }))
            ];

            return EmailMessage.constructPersonPocTags(email, tags, fieldName);
          }

          return null;
        } catch (error) {
          logger.error('Error when extracting persons', error, email);
          return null;
        }
      })
    );

    return extractedPersons.filter((p) => p.value !== null).map((p) => p.value);
  }

  /**
   * constructPersonPocTags - Constructs the person && pointofcontact objects using email, tags, fieldName
   * @param {{name: string, address: string, identifier: string}} email - The Email object
   * @param {[{name: string, label; string, reachable: string, type: string}] | []} tags - Array of tags
   * @param {string} fieldName - The Header field.
   */
  static constructPersonPocTags(email, tags, fieldName) {
    const { address, identifier, name } = email;
    return {
      person: {
        name,
        email: address,
        url: '',
        image: '',
        address: '',
        alternate_names: [],
        sameAs: [],
        givenName: name,
        familyName: '',
        jobTitle: '',
        identifiers: [identifier]
      },
      pointOfContact: {
        messageid: '',
        name: name ?? '',
        from: fieldName === 'from',
        replyTo: fieldName === 'reply-to' || fieldName === 'reply_to',
        to: fieldName === 'to',
        cc: fieldName === 'cc',
        bcc: fieldName === 'bcc',
        body: fieldName === 'body',
        personid: ''
      },
      tags
    };
  }
}

export default EmailMessage;
