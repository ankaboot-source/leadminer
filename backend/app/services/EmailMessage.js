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
  constructor(sequentialId, header, body, user, folder, isLast) {
    this.sequentialId = sequentialId;
    this.header = header || {};
    this.body = body || {};
    this.user = user;
    this.folderPath = folder;
    this.isLast = isLast;
  }

  /**
   * Determines whether the email header contains any newsletter header fields or not.
   * @returns True or False
   */
  isNewsletter() {
    return emailMessageHelpers.hasSpecificHeader(
      this.header,
      newsletterHeaders
    );
  }

  /**
   * Determines whether the email header contains any transactional header fields or not.
   * @returns {boolean}
   */
  isTransactional() {
    return emailMessageHelpers.hasSpecificHeader(
      this.header,
      transactionalHeaders
    );
  }

  /**
   * Determines if the email header contains any mailing list header fields or not.
   * @returns {boolean}
   */
  isList() {
    return emailMessageHelpers.hasSpecificHeader(
      this.header,
      mailingListHeaders
    );
  }

  /**
   * Determines if the email header has a `references` field or not.
   * @returns {boolean}
   */
  isConversation() {
    return emailMessageHelpers.hasSpecificHeader(this.header, ['references']);
  }

  /**
   * Gets the list of references from  the email header if the message is in a conversation, otherwise returns an empty array.
   * @returns {string[]}
   */
  getReferences() {
    if (this.isConversation()) {
      return this.header.references[0].split(' '); // references in header comes as ["<r1> <r2> <r3> ..."]
    }
    return [];
  }

  /**
   * Gets the `list-id` header field if the email is in a mailing list otherwise returns an empty string.
   * @returns {string}
   */
  getListId() {

    if (this.isList()) {
      return this.header['list-id'][0].match(REGEX_LIST_ID)[0]; // extracts this part <list-id>
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
   * buildTag takes in a name, label, reachable, and type, and returns an object with those properties
   * used to build a tag object type
   * @param {string} name - The name of the tag.
   * @param {string} label - The label of the tag.
   * @param {int} reachable - true if the tag is reachable from the current tag, false otherwise
   * @param {string} type - The type of the tag.
   * @returns An object with the following properties:
   *   name: name,
   *   label: label,
   *   reachable: reachable,
   *   type: type,
   */
  buildTag(name, label, reachable, type) {
    const userid = this.user.id;
    return {
      userid,
      name,
      label,
      reachable,
      type
    };
  }

  /**
   * getTagsField - Builds tags for field 'FROM'
   * @param {string} fieldName - 
   * @returns {array} returns a list of tags
   */
  getTagsField(fieldName) {
    const tags = [];
    if (fieldName === 'from') {
      if (this.isNewsletter()) {
        tags.push(this.buildTag('newsletter', 'Newsletter', 2, 'refined'));
      }
      if (this.isTransactional()) {
        tags.push(
          this.buildTag('transactional', 'Transactional', 2, 'refined')
        );
      }
      if (this.isList()) {
        tags.push(this.buildTag('list', 'List', 2, 'refined'));
      }
    }
    return tags;
  }

  /**
   * getTagsEmail- Build tags for email
   * @param {*} email
   * @param {*} emailType - Type of an email (no-reply, personal, ...) 
   * @returns 
   */
  getTagsEmail(email, emailType) {

    if (emailMessageHelpers.isNoReply(email.address)) {
      return [this.buildTag('no-reply', 'noReply', 0, 'refined')];
    }
    if (emailType && emailType !== '') {
      return [this.buildTag(emailType.toLowerCase(), emailType, 1, 'refined')];
    }
    return [];
  }

  /**
   * extractEmailsAddresses - extracts emails from the header and body of an email, then returns an object
   */
  async extractEmailsAddresses() {

    const extractedData = {};

    extractedData.message = {
      channel: 'imap',
      folder_path: this.folderPath,
      date: this.getDate(),
      userid: this.user.id,
      message_id: this.getMessageId(),
      references: this.getReferences(),
      list_id: this.getListId(),
      conversation: this.isConversation()

    };

    extractedData.persons = [];
    this.message = extractedData.message;

    const messagingFields = this.getMessagingFieldsFromHeader();

    for (const key of Object.keys(messagingFields)) {
      const emails = regExHelpers.extractNameAndEmail( // extract Name and Email in case of a header
        messagingFields[`${key}`]
      );
      const p = await this.emailsAddressesExtractedFromHeader(emails, key);
      extractedData.persons.push(...p);
    }

    const emails = regExHelpers.extractNameAndEmailFromBody(
      this.body.toString('utf8')
    );
    delete this.body;
    // store extracted emails
    extractedData.persons.push(...await this.emailsAddressesExtractedFromBody(emails));

    return extractedData;
  }


  /**
   * emailsAddressesExtractedFromHeader takes the extracted email addresses,
   * checks for validty then build a person objects.
   * @param {object} messages - an object containing the saved message data row
   * @param {array} emails - an array of objects that contains the extracted email addresses and the names
   * @param {string} fieldName - the current extracting field name (eg: from , cc , to...)
   * @returns {Object[]} An array of objects
   */
  async emailsAddressesExtractedFromHeader(emails, fieldName) {

    //const persons = []

    for (const email of emails.filter((email) => email && this.user.email !== email?.address)) {
      const domain = await domainHelpers.checkDomainStatus(email.address); // get the domain status //TODO: SAVE DOMAIN STATUS IN DB

      if (domain[0]) { // Valid email

        const tags = this.getTagsField(fieldName);
        const name = email?.name.replaceAll(/"|'/g, '');

        const emailType = emailAddressHelpers
          .findEmailAddressType(email.address, [email?.name], domain[1]);

        tags.push(...this.getTagsEmail(email, emailType));
        return [this.extractPerson(email.address, name, tags, email?.identifier , fieldName)];
      }
      const member = await redisClientForNormalMode.sismember(
        'invalidDomainEmails',
        email.address
      );
      if (member === 0) {
        redisClientForNormalMode.sadd('invalidDomainEmails', email.address);
      }
    }
    return [];
  }

  /**
   * emailsAddressesExtractedFromBody takes the extracted email addresses from the body
   * and checks validty then return a list of persons.
   * @param {object} messages - an object containing the saved message data row
   * @param {array} emails - an array of objects that contains the extracted email addresses
   * @returns {Object[]} An array of object.
   */
  async emailsAddressesExtractedFromBody(emails) {

    // const persons = []

    for (const email of emails.filter((email) => email && this.user.email !== email.address)) {

      const domain = await domainHelpers.checkDomainStatus(email); // check for Domain validity

      if (domain[0]) {

        const emailType = emailAddressHelpers.findEmailAddressType(
          email, [email?.name ?? ''], domain[1]
        );
        const tags = this.getTagsEmail(email, emailType);
        return [this.extractPerson(email, '', tags, 'body')]; // TODO: WHY poc jumps from 3.3k to 33k if u remove return statement
      }

      const member = await redisClientForNormalMode.sismember(
        'invalidDomainEmails',
        email.address
      );
      if (member === 0) {
        redisClientForNormalMode.sadd('invalidDomainEmails', email.address);
      }
    }

    return [];
  }


  /**
   * extractPerson takes the email address, name, tags and field name 
   * and returns an object with person, pointofcontact, tags.
   * @param email - the email address of the person
   * @param name - The name of the person
   * @param tags - an array of tags to be added to the person
   * @param identifier - The identifier of the person.
   * @param fieldName - the name of the field that the email was found in
   */
  extractPerson(email, name, tags, identifier, fieldName) {

    for (const tag of tags) {
      tag.email = email.toLowerCase();
    }
    return {
      person: {
        name: name ?? '',
        email: email.toLowerCase(),
        _userid: this.user.id,
        url: '',
        image: '',
        address: '',
        alternate_names: [],
        same_as: [],
        given_name: name,
        family_name: '',
        job_title: '',
        identifiers: [identifier]
        // works_for: ''  Will be retrieved with transmutation
      },
      pointOfContact: {
        
        message_id: this.message.message_id, //  TODO: To save us some for loops, but needs to change.
        email: email.toLowerCase(), // TODO: To save us some for loops, but needs to change.
        
        userid: this.user.id,
        messageid: '',
        name: name ?? '',
        _from: fieldName === 'from',
        reply_to: fieldName === 'reply-to' || fieldName === 'reply_to',
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
