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

const FIELDS = ['to', 'from', 'cc', 'bcc', 'reply-to'];
const logger = require('../utils/logger')(module);

const { db } = require('../db');

class EmailMessage {
  /**
   * EmailMessage constructor
   * @param sequentialId - The sequential ID of the message.
   * @param header - The header of the message.
   * @param body - The body of the message.
   * @param user - The user.

   */
  constructor(sequentialId, header, body, user, folder) {
    this.sequentialId = sequentialId;
    this.header = header || {};
    this.body = body || {};
    this.user = user;
    this.folderPath = folder;
  }

  /**
   * If the header contains any of the fields in the NEWSLETTER_HEADER_FIELDS array, then return true
   * @returns True or False
   */
  isNewsletter() {
    return emailMessageHelpers.hasSpecificHeader(
      this.header,
      newsletterHeaders
    );
  }

  /**
   * isTransactional returns true if the email is transactional, and false if it's not
   * @returns {boolean}
   */
  isTransactional() {
    return emailMessageHelpers.hasSpecificHeader(
      this.header,
      transactionalHeaders
    );
  }

  /**
   * isList returns true if the email has List-Post in header, and false if it's not
   * @returns {boolean}
   */
  isList() {
    return emailMessageHelpers.hasSpecificHeader(
      this.header,
      mailingListHeaders
    );
  }

  /**
   * isInConversation returns 1 if the header object has a key called "references", otherwise return 0
   * @returns {boolean}
   */
  isConversation() {
    return emailMessageHelpers.hasSpecificHeader(this.header, ['references']);
  }

  /**
   * getReferences returns a list for references from header if message in conversation, otherwise empty array
   * @returns {string[]}
   */
  getReferences() {
    if (this.isConversation()) {
      return this.header.references[0].split(' '); // references in header comes as ["<r1> <r2> <r3> ..."]
    }
    return [];
  }

  /**
   * getDate returns the parsed value of the "date" property of the header if it should be parsed
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
   * getMessagingFieldsFromHeader returns an object with only the messaging fields from the header
   * @returns An object with only the messaging fields from the header.
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
   * getMessageId returns the message-id of the email
   * @returns The message-id of the email.
   */
  getMessageId() {
    if (this.header['message-id']) {
      return this.header['message-id'][0].substring(0, 60);
    }
    return `message_id_unknown ${this.header.date}`;
  }

  /**
   * extractThenStoreEmailsAddresses extracts emails from the header and body of an email, then stores them in a database
   */
  async extractThenStoreEmailsAddresses() {
    const { data, error } = await db.insertMessage(
      this.getMessageId(),
      this.user.id,
      'imap',
      this.folderPath,
      this.getDate(),
      '',
      this.getReferences(),
      this.isConversation()
    );

    const message = data;

    if (error) {
      logger.error('Error when inserting to messages table.', {
        error: error.message,
        code: error.code,
        emailMessageDate: this.getDate()
      });
    } else {
      const messagingFields = this.getMessagingFieldsFromHeader();

      for (const key of Object.keys(messagingFields)) {
        // extract Name and Email in case of a header
        const emails = regExHelpers.extractNameAndEmail(
          messagingFields[`${key}`]
        );

        await this.storeEmailsAddressesExtractedFromHeader(
          message,
          emails,
          key
        );
      }

      const emails = regExHelpers.extractNameAndEmailFromBody(
        this.body.toString('utf8')
      );
      delete this.body;
      // store extracted emails
      this.storeEmailsAddressesExtractedFromBody(message, emails);
    }
  }

  getTags(fieldName) {
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
   * storeEmailsAddressesExtractedFromHeader takes the extracted email addresses,
   * gives tags, checks for noreply, checks domain and saves them to the database.
   * @param {object} messages - an object containing the saved message data row
   * @param {array} emails - an array of objects that contains the extracted email addresses and the names
   * @param {string} fieldName - the current extracting field name (eg: from , cc , to...)
   * @returns Nothing is being returned.
   */
  async storeEmailsAddressesExtractedFromHeader(message, emails, fieldName) {
    const tags = this.getTags(fieldName);

    const filteredEmails = emails.filter(
      (email) => email && this.user.email !== email?.address
    );

    for (const email of filteredEmails) {
      // get the domain status //TODO: SAVE DOMAIN STATUS IN DB
      const domain = await domainHelpers.checkDomainStatus(email.address);

      const emailType = emailAddressHelpers.findEmailAddressType(
        email.address,
        [email?.name],
        domain[1]
      );

      if (emailMessageHelpers.isNoReply(email.address)) {
        tags.push(this.buildTag('no-reply', 'noReply', 0, 'refined'));
      } else if (emailType !== '') {
        tags.push(
          this.buildTag(emailType.toLowerCase(), emailType, 1, 'refined')
        );
      }

      if (domain[0]) {
        await this.storeEmails(
          message,
          email.address,
          email?.name.replaceAll(/"|'/g, ''),
          tags,
          fieldName
        );
        return;
      }

      const member = await redisClientForNormalMode.sismember(
        'invalidDomainEmails',
        email.address
      );

      if (member === 0) {
        redisClientForNormalMode.sadd('invalidDomainEmails', email.address);
      }
    }
  }

  /**
   * storeEmailsAddressesExtractedFromBody takes the extracted email addresses from the body
   * and saves them to the database
   * @param {object} messages - an object containing the saved message data row
   * @param {array} emails - an array of objects that contains the extracted email addresses
   * @returns Nothing is being returned.
   */
  storeEmailsAddressesExtractedFromBody(message, emails) {
    if (emails.length === 0) {
      delete this.body;
      return;
    }

    emails
      .filter((email) => this.user.email !== email.address)
      .forEach(async (email) => {
        const domain = await domainHelpers.checkDomainStatus(email);
        const emailType = emailAddressHelpers.findEmailAddressType(
          email,
          [email?.name ?? ''],
          domain[1]
        );

        const tags = [];
        if (emailMessageHelpers.isNoReply(email)) {
          tags.push(this.buildTag('no-reply', 'noReply', 0, 'refined'));
        } else if (emailType !== '') {
          tags.push(
            this.buildTag(emailType.toLowerCase(), emailType, 1, 'refined')
          );
        }

        if (domain[0]) {
          await this.storeEmails(message, email, '', tags, 'body');
          return;
        }

        const member = await redisClientForNormalMode.sismember(
          'invalidDomainEmails',
          email.address
        );

        if (member === 0) {
          redisClientForNormalMode.sadd('invalidDomainEmails', email.address);
        }
      });
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
   * storeEmails store the email address, name, tags and field name in the database
   * @param message - the message object returned from the API
   * @param email - the email address of the person
   * @param name - The name of the person
   * @param tags - an array of tags to be added to the person
   * @param fieldName - the name of the field that the email was found in
   */
  async storeEmails(message, email, name, tags, fieldName) {
    const result = await db.insertPerson(
      name ?? '',
      email.toLowerCase(),
      this.user.id
    );

    const person = result.data;

    if (result.error) {
      logger.error('Error when inserting to persons table.', {
        error: result.error.message,
        code: result.error.code,
        emailMessageDate: this.getDate()
      });
    }
    if (person) {
      //if saved and no errors then we can store the person linked to this point of contact
      const pointOfContactUpsertionResult = await db.insertPointOfContact(
        message.id,
        this.user.id,
        person.id,
        fieldName,
        name ?? ''
      );

      if (pointOfContactUpsertionResult.error) {
        logger.error('Error when inserting to pointOfContact table.', {
          error: pointOfContactUpsertionResult.error.message,
          code: pointOfContactUpsertionResult.error.code,
          emailMessageDate: this.getDate()
        });
      }

      for (const tag of tags) {
        tag.personid = person.id;
      }

      db.createTags(tags)
        // eslint-disable-next-line no-unused-vars
        .then((data, error) => {
          if (error) {
            logger.error('Error when creating tags.', {
              error: error.message,
              emailMessageDate: this.getDate()
            });
          }
        });
    }
  }
}
module.exports = EmailMessage;
