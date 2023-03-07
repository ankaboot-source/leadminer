const regExHelpers = require('../utils/helpers/regexpHelpers');
const emailMessageHelpers = require('../utils/helpers/emailMessageHelpers');
const emailAddressHelpers = require('../utils/helpers/emailAddressHelpers');
const domainHelpers = require('../utils/helpers/domainHelpers');
const { REGEX_LIST_ID } = require('../utils/constants');
const {
  EMAIL_HEADERS_NEWSLETTER,
  EMAIL_HEADERS_TRANSACTIONAL,
  EMAIL_HEADERS_MAILING_LIST
} = require('../utils/constants');
const FIELDS = ['to', 'from', 'cc', 'bcc', 'reply-to'];

class EmailMessage {
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
    this.header = header || {};
    this.body = body || '';
    this.folderPath = folder;
  }

  /**
   * Determines whether the email header contains any newsletter header fields or not.
   * @returns True or False
   */
  isNewsletter() {
    return (
      emailMessageHelpers.getSpecificHeader(
        this.header,
        EMAIL_HEADERS_NEWSLETTER
      ) !== null
    );
  }

  /**
   * Determines whether the email header contains any transactional header fields or not.
   * @returns {boolean}
   */
  isTransactional() {
    return (
      emailMessageHelpers.getSpecificHeader(
        this.header,
        EMAIL_HEADERS_TRANSACTIONAL
      ) !== null
    );
  }

  /**
   * Determines whether the email header contains any List header fields or not.
   * @returns {boolean}
   */
  isList() {
    return (
      emailMessageHelpers.getSpecificHeader(
        this.header,
        EMAIL_HEADERS_MAILING_LIST
      ) !== null
    );
  }

  /**
   * Gets the list of references from  the email header if the message is in a conversation, otherwise returns an empty array.
   * @returns {string[]}
   */
  getReferences() {
    const references = emailMessageHelpers.getSpecificHeader(this.header, [
      'references'
    ]);

    if (references) {
      return references[0].split(' ').filter((ref) => ref !== ''); // references in header comes as ["<r1> <r2> <r3> ..."]
    }

    return [];
  }

  /**
   * Gets the `list-id` header field if the email is in a mailing list otherwise returns an empty string.
   * @returns {string}
   */
  getListId() {
    if (!this.isList()) {
      return '';
    }
    const listId = emailMessageHelpers.getSpecificHeader(this.header, [
      'list-id'
    ]);
    const matchId = listId ? listId[0].match(REGEX_LIST_ID) : null;
    return matchId ? matchId[0] : '';
  }

  /**
   * Returns the date from the header object, or null if it is not present or not a valid date
   * @returns {(string|null)} The UTC formatted date string or null if it is not present or not a valid date.
   */
  getDate() {
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
  getMessagingFieldsFromHeader() {
    const messagingProps = {};
    Object.keys(this.header).forEach((key) => {
      if (FIELDS.includes(key)) {
        messagingProps[`${key}`] = this.header[`${key}`][0];
      }
    });
    return messagingProps;
  }

  /**
   * Gets the `message-id` header field of the email.
   * @returns {string}
   */
  getMessageId() {
    return this.header['message-id'][0];
  }

  /**
   * constructs tags for header field FROM.
   * @returns { [{name: string, reachable: int, source: string}] | []}
   */
  getMessageTags() {
    const tags = [];

    if (this.isNewsletter()) {
      tags.push({ name: 'newsletter', reachable: 2, source: 'refined' });
    }
    if (this.isTransactional()) {
      tags.push({ name: 'transactional', reachable: 2, source: 'refined' });
    }
    if (this.isList()) {
      tags.push({ name: 'list', reachable: 2, source: 'refined' });
    }

    return tags;
  }

  /**
   * Gets tags based on email.
   * @param {{name, address ,identifier ,domain}} email  - Email object
   * @param {string} emailType - The type of the email
   * @returns { [{name: string, reachable: int, source: string}] | []}
   *  An empty array if there is no tags, else returns array of objects.
   *
   */
  getTags(email, emailType) {
    const tags = [];

    if (email && emailMessageHelpers.isNoReply(email.address)) {
      tags.push({ name: 'no-reply', reachable: 0, source: 'refined' });
    }

    if (emailType && emailType !== '') {
      tags.push({
        name: emailType.toLowerCase(),
        reachable: 1,
        source: 'refined'
      });
    }

    return tags;
  }

  /**
   * extractEmailsAddresses - extracts emails from the header and body of an email, then returns an object
   * @returns {Promise<{message: {object}, persons: {person: object, pointOfContact: object, tags: object[]}}[]>}
   */
  async extractEmailsAddresses() {
    const extractedData = {
      message: {
        channel: 'imap',
        folderPath: this.folderPath,
        date: this.getDate(),
        messageId: this.getMessageId(),
        references: this.getReferences(),
        listId: this.getListId(),
        conversation: this.getReferences().length > 0
      },
      persons: []
    };
    this.message = extractedData.message;

    const messagingFields = this.getMessagingFieldsFromHeader();
    const messageTags = this.getMessageTags();

    for (const headerKey of Object.keys(messagingFields)) {
      const emails = regExHelpers.extractNameAndEmail(
        // extract Name and Email in case of a header
        messagingFields[`${headerKey}`]
      );
      const persons = await this.extractPersons(emails, headerKey, messageTags);
      extractedData.persons.push(...persons);
    }

    if (this.body !== '') {
      const emails = regExHelpers.extractNameAndEmailFromBody(this.body);
      extractedData.persons.push(
        ...(await this.extractPersons(emails, 'body', messageTags))
      );
    }

    return extractedData;
  }

  /**
   * personsExtractedFromHeader checks for email validty then returns a person objects with thier tags and point of contact.
   * @param {Object[]} emails - an array of objects that contains the extracted email addresses and the names
   * @param {string} fieldName - the current extracted field name (eg: from , cc , to...)
   * @returns {Promise<Object[]>} An array of objects
   */
  async extractPersons(emails, fieldName, messageTags) {
    const extractedContacts = [];
    for (const email of emails) {
      if (email.address === this.userEmail) {
        continue;
      }

      const [domainIsValid, domainType] = await domainHelpers.checkDomainStatus(
        this.redisClientForNormalMode,
        email.domain
      );

      if (domainIsValid) {
        const emailTags = emailAddressHelpers.getEmailTags(email, domainType);

        extractedContacts.push(
          EmailMessage.constructPersonPocTags(
            email,
            fieldName === 'from' ? [...messageTags, ...emailTags] : emailTags,
            fieldName
          )
        );
      }

      await this.redisClientForNormalMode.sadd(
        'invalidDomainEmails',
        email.address
      );
    }
    return extractedContacts;
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
        _from: fieldName === 'from',
        replyTo: fieldName === 'reply-to' || fieldName === 'reply_to',
        _to: fieldName === 'to',
        cc: fieldName === 'cc',
        bcc: fieldName === 'bcc',
        body: fieldName === 'body',
        personid: ''
      },
      tags
    };
  }
}

module.exports = EmailMessage;
