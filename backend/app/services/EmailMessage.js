'use-strict';
const regExHelpers = require('../utils/helpers/regexpHelpers');
const emailMessageHelpers = require('../utils/helpers/emailMessageHelpers');
const emailAddressHelpers = require('../utils/helpers/minedDataHelpers');
const domainHelpers = require('../utils/helpers/domainHelpers');
const dateHelpers = require('../utils/helpers/dateHelpers');
const { redis } = require('../utils/redis');
const redisClientForNormalMode = redis.getClient();
const {
  newsletterHeaders,
  transactionalHeaders,
  mailingListHeaders
} = require('../config/emailHeaders.config');
const { REGEX_LIST_ID } = require('../utils/constants');
const FIELDS = ['to', 'from', 'cc', 'bcc', 'reply-to'];

class EmailMessage {
  /**
   * EmailMessage constructor
   * @param sequentialId - The sequential ID of the message.
   * @param header - The header of the message.
   * @param body - The body of the message.
   * @param user - The user.

   */
  constructor(userEmail, sequentialId, header, body, folder, isLast) {
    this.userEmail = userEmail;
    this.sequentialId = sequentialId;
    this.header = header || {};
    this.body = body || {};
    this.folderPath = folder;
    this.isLast = isLast;
  }

  /**
   * Determines whether the email header contains any newsletter header fields or not.
   * @returns True or False
   */
  isNewsletter() {
    return (
      emailMessageHelpers.getSpecificHeader(this.header, newsletterHeaders) !==
      null
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
        transactionalHeaders
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
        mailingListHeaders
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
    const listId = this.isList()
    ? emailMessageHelpers.getSpecificHeader(this.header,['list-id'])
    : null

    if (listId) {
      return listId[0].match(REGEX_LIST_ID)[0];
    }
    return '';
  }

  /**
   * getDate - Returns the parsed value of the "date" property of the header if it should be parsed
   * @returns The date of the article.
   */
  getDate() {
    if (this.header.date) {
      if (Date.parse(this.header.date[0])) {
        return dateHelpers.parseDate(this.header.date[0]);
      }
      return this.header.date;
    }
    return this.header.date;
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
    if (this.header['message-id']) {
      return this.header['message-id'][0];
    }
    return `message_id_unknown ${this.header.date}`;
  }

  /**
   * constructs tags for header field FROM.
   * @param {string} fieldName - header field name
   * @returns { [{name: string, reachable: int, source: string}] | []}
   */
  getTagsField(fieldName) {

    const tags = [];

    if (fieldName === 'from') {
      if (this.isNewsletter()) {
        tags.push({name:'newsletter', reachable:2, source:'refined'});
      }
      if (this.isTransactional()) {
        tags.push({name:'transactional', reachable:2, source:'refined'});
      }
      if (this.isList()) {
        tags.push({name:'list', reachable:2, source:'refined'});
      }
    }
    return tags;
  }

  /**
   * Constructs tags from fieldName, email, emailType.
   * @param {string} fieldName - Header field (TO, FROM, CC, BCC ...)
   * @param {string} email  - Email address
   * @param {string} emailType - The type of the email
   * @returns { [{name: string, reachable: int, source: string}] | []}
   *  An empty array if there is no tags, else returns array of objects.
   *  
   */
  getTags(fieldName, email, emailType) {

    const tags = this.getTagsField(fieldName);

    if (email && emailMessageHelpers.isNoReply(email.address)) {
      tags.push({name:'no-reply', reachable:0, source:'refined'});
    }
    if (emailType && emailType !== '') {
      tags.push({name:emailType.toLowerCase(), reachable:1, source:'refined'});
    }

    return tags;
  }

  /**
   * extractEmailsAddresses - extracts emails from the header and body of an email, then returns an object
   * @returns {{message: {object}, persons: {person: object, pointOfContact: object, tags: object[]}[]}}
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

    for (const key of Object.keys(messagingFields)) {
      const emails = regExHelpers.extractNameAndEmail( // extract Name and Email in case of a header
        messagingFields[`${key}`]
      );
      const persons = await this.personsExtractedFromHeader(emails, key);
      extractedData.persons.push(...persons);
    }

    const emails = regExHelpers.extractNameAndEmailFromBody(
      this.body.toString('utf8')
    );
    delete this.body;
    extractedData.persons.push(...await this.personsExtractedFromBody(emails));

    return extractedData;
  }

  /**
   * personsExtractedFromHeader checks for email validty then returns a person objects with thier tags and point of contact.
   * @param {array} emails - an array of objects that contains the extracted email addresses and the names
   * @param {string} fieldName - the current extracted field name (eg: from , cc , to...)
   * @returns {Object[]} An array of objects
   */
  async personsExtractedFromHeader(emails, fieldName) {

    for (const email of emails.filter((e) => e && this.userEmail !== e?.address)) {
      const domain = await domainHelpers.checkDomainStatus(email.address); // get the domain status //TODO: SAVE DOMAIN STATUS IN DB

      if (domain[0]) { // Valid email

        const emailType = emailAddressHelpers
          .findEmailAddressType(email.address, [email?.name], domain[1]);
        const tags = this.getTags(fieldName, email, emailType);
        return [EmailMessage.constructPersonPocTags(email, tags, fieldName)];
      }

      redisClientForNormalMode.sismember('invalidDomainEmails', email.address).then((member) => {
        if (member === 0) {
          redisClientForNormalMode.sadd('invalidDomainEmails', email.address);
        }
      });
    }
    return [];
  }

  /**
   * personsExtractedFromBody checks for email validty then returns a person objects with thier tags and point of contact.
   * @param {array} emails - an array of objects that contains the extracted email addresses
   * @returns {Object[]} An array of object.
   */
  async personsExtractedFromBody(emails) { // TODO: why takes an array of emails but don't process all of them.

    for (const email of emails.filter((e) => e && this.userEmail !== e.address)) {

      const domain = await domainHelpers.checkDomainStatus(email); // check for Domain validity

      if (domain[0]) {

        const emailType = emailAddressHelpers.findEmailAddressType(
          email, [email?.name ?? ''], domain[1]
        );
        const tags = this.getTags('', email, emailType);
        return [EmailMessage.constructPersonPocTags(email, tags, 'body')];
      }

      redisClientForNormalMode.sismember('invalidDomainEmails', email.address).then((member) => {
        if (member === 0) {
          redisClientForNormalMode.sadd('invalidDomainEmails', email.address);
        }
      });
    }

    return [];
  }

  /**
   * constructPersonPocTags - Constructs the person && pointofcontact objects using email, tags, fieldName 
   * @param {{name: string, adddress: string, identifier: string}} email - The Email object
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
